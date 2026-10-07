import { timingSafeEqual } from "node:crypto";
import { handleWebLoginConfirm, handleWebLoginStart } from "@/features/auth/web-login-bot";
import { WEB_LOGIN_CALLBACK_PREFIX, WEB_LOGIN_START_PREFIX } from "@/features/auth/web-login";
import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeHtml, removeKeyboard, sendTelegramMessage, shareContactKeyboard, syncBotMenuButtonOnce } from "@/lib/telegram/bot";
import { makeT } from "@/lib/i18n/translate";
import { formatPhone } from "@/lib/format";
import { parseBotCommand, resolveTelegramLocale, telegramUpdateSchema } from "@/features/notifications/telegram";
import { ensureTelegramProfile, normalizeContactPhone } from "@/features/auth/telegram-session";
import { botMenuKeyboard, continueAfterPhone, handleBotCallback, handleBotText, sendCvPdf, sendLanguagePicker, sendMatchingJobs, startCv, type BotCtx } from "@/features/bot/cv-bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function secretMatches(header: string | null, secret: string): boolean {
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

const UZ_PHONE = /^\+998\d{9}$/;

/**
 * Telegram Bot webhook (setWebhook secret_token bilan).
 * /start [login] → salomlashish + "Ilovani ochish" tugmasi; raqam ulanmagan bo'lsa "📱 Raqamni yuborish" (request_contact).
 * contact (faqat o'z raqami) → telegram_accounts.phone — saytda shu raqam bilan kirishda kod bot orqali keladi.
 * /cv, /jobs, /pdf va inline tugmalar (callback_query) → bot ichida CV to'ldirish, PDF, mos ishlar (features/bot).
 * Har doim 200 (Telegram qayta yubormasin).
 */
export async function POST(req: NextRequest) {
  const { TELEGRAM_WEBHOOK_SECRET } = getServerEnv();
  if (!TELEGRAM_WEBHOOK_SECRET || !secretMatches(req.headers.get("x-telegram-bot-api-secret-token"), TELEGRAM_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Yangi deploydan keyin bot menyusidagi Mini App tugmasi eski manzilda qolib ketmasin
  void syncBotMenuButtonOnce();

  const parsed = telegramUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: true, ignored: "unparsable" });

  // ---------- inline tugma ----------
  const callback = parsed.data.callback_query;
  if (callback) {
    const chat = callback.message?.chat;
    if (callback.from.is_bot || !chat || chat.type !== "private" || !callback.data) return NextResponse.json({ ok: true, ignored: "callback" });
    try {
      const admin = createAdminClient();
      const { data: account } = await admin.from("telegram_accounts").select("language_code, profiles(locale)").eq("telegram_user_id", callback.from.id).maybeSingle();
      const locale = resolveTelegramLocale([account?.profiles?.locale, account?.language_code, callback.from.language_code]);
      const ctx: BotCtx = { admin, from: callback.from, chatId: chat.id, locale, t: makeT(locale) };
      // Brauzerda kirishni tasdiqlash
      if (callback.data.startsWith(WEB_LOGIN_CALLBACK_PREFIX)) {
        await handleWebLoginConfirm(admin, ctx.t, callback.id, chat.id, callback.message?.message_id ?? null, callback.from.id, callback.data);
        return NextResponse.json({ ok: true, webLogin: "confirm" });
      }
      await handleBotCallback(ctx, callback.id, callback.data, callback.message?.message_id ?? null);
      return NextResponse.json({ ok: true, callback: true });
    } catch (e) {
      console.error("[telegram webhook] callback", e instanceof Error ? e.message : e);
      return NextResponse.json({ ok: true, error: "internal" });
    }
  }

  const message = parsed.data.message;
  if (!message?.from || message.from.is_bot || message.chat.type !== "private") return NextResponse.json({ ok: true, ignored: "not_private_message" });

  const from = message.from;
  const chatId = message.chat.id;
  const command = parseBotCommand(message.text);

  try {
    const admin = createAdminClient();
    const { data: account } = await admin
      .from("telegram_accounts")
      .select("profile_id, language_code, phone, profiles(locale)")
      .eq("telegram_user_id", from.id)
      .maybeSingle();

    const locale = resolveTelegramLocale([account?.profiles?.locale, account?.language_code, from.language_code]);
    const t = makeT(locale);
    const tt = (key: string, params?: Record<string, string | number>) => escapeHtml(t(`notifications.telegram.${key}`, params));
    const bot: BotCtx = { admin, from, chatId, locale, t };

    // ---------- brauzerda kodsiz kirish: /start wl_<token> ----------
    if (command?.name === "start" && command.param?.startsWith(WEB_LOGIN_START_PREFIX)) {
      await handleWebLoginStart(admin, t, chatId, from, command.param);
      return NextResponse.json({ ok: true, webLogin: "start" });
    }

    if (account) {
      await admin
        .from("telegram_accounts")
        .update({ bot_started: true, last_seen_at: new Date().toISOString(), language_code: from.language_code ?? account.language_code, username: from.username ?? null })
        .eq("telegram_user_id", from.id);
    }

    // ---------- kontakt: raqamni ulash ----------
    if (message.contact) {
      if (message.contact.user_id !== from.id) {
        await sendTelegramMessage(chatId, tt("phone_not_own"), shareContactKeyboard(t("notifications.telegram.share_phone_button")));
        return NextResponse.json({ ok: true, contact: "not_own" });
      }
      const phone = normalizeContactPhone(message.contact.phone_number);
      if (!phone) {
        await sendTelegramMessage(chatId, tt("phone_invalid"), removeKeyboard);
        return NextResponse.json({ ok: true, contact: "invalid" });
      }
      const profileId = await ensureTelegramProfile(admin, from, locale);
      // raqam boshqa (eski) Telegram hisobida bo'lsa — undan olib qo'yiladi (raqam egasi o'zgargan)
      await admin.from("telegram_accounts").update({ phone: null, phone_shared_at: null }).eq("phone", phone).neq("telegram_user_id", from.id);
      const { error: phoneErr } = await admin
        .from("telegram_accounts")
        .update({ phone, phone_shared_at: new Date().toISOString(), bot_started: true })
        .eq("telegram_user_id", from.id);
      if (phoneErr) throw new Error(`phone update: ${phoneErr.message}`);

      // profil kontakti bo'sh bo'lsa — Telegram tasdiqlagan raqam bilan to'ldiriladi
      if (UZ_PHONE.test(phone)) {
        const [{ data: own }, { data: taken }] = await Promise.all([
          admin.from("profile_contacts").select("phone").eq("profile_id", profileId).maybeSingle(),
          admin.from("profile_contacts").select("profile_id").eq("phone", phone).maybeSingle(),
        ]);
        if (!own?.phone && !taken) {
          await admin.from("profile_contacts").update({ phone, phone_verified_at: new Date().toISOString() }).eq("profile_id", profileId);
        }
      }

      await sendTelegramMessage(chatId, tt("phone_linked", { phone: formatPhone(phone) }), removeKeyboard);
      // CV oxirgi savolda (telefon) turgan bo'lsa — CV tugatiladi va PDF yuboriladi
      if (await continueAfterPhone(bot)) return NextResponse.json({ ok: true, contact: "linked", cv: true });
      await sendTelegramMessage(chatId, tt("hint"), botMenuKeyboard(t));
      return NextResponse.json({ ok: true, contact: "linked" });
    }

    // ---------- bot ichida CV / ishlar ----------
    if (command?.name === "cv") {
      await startCv(bot);
      return NextResponse.json({ ok: true, command: "cv" });
    }
    if (command?.name === "jobs") {
      await sendMatchingJobs(bot, 0);
      return NextResponse.json({ ok: true, command: "jobs" });
    }
    if (command?.name === "lang") {
      await sendLanguagePicker(bot, "menu");
      return NextResponse.json({ ok: true, command: "lang" });
    }
    if (command?.name === "pdf") {
      await sendCvPdf(bot);
      return NextResponse.json({ ok: true, command: "pdf" });
    }
    if (!command && message.text && (await handleBotText(bot, message.text))) return NextResponse.json({ ok: true, cv: true });

    // ---------- /start va boshqa matnlar ----------
    const isStart = command?.name === "start";
    const text = isStart ? `${tt("welcome")}\n\n${tt("hint")}` : tt("hint");
    await sendTelegramMessage(chatId, text, botMenuKeyboard(t));

    if (account?.phone) {
      if (isStart && command?.param === "login") await sendTelegramMessage(chatId, tt("phone_already_linked", { phone: formatPhone(account.phone) }));
    } else if (isStart) {
      await sendTelegramMessage(chatId, tt("share_phone_prompt"), shareContactKeyboard(t("notifications.telegram.share_phone_button")));
    }

    return NextResponse.json({ ok: true, command: command?.name ?? null, linked: !!account });
  } catch (e) {
    console.error("[telegram webhook]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: true, error: "internal" });
  }
}
