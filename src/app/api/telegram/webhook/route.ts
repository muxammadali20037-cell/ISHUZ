import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { answerCallback, escapeHtml, removeKeyboard, sendTelegramMessage, shareContactKeyboard, syncBotMenuButtonOnce, type InlineKeyboard } from "@/lib/telegram/bot";
import { makeT } from "@/lib/i18n/translate";
import { formatPhone } from "@/lib/format";
import { parseBotCommand, resolveTelegramLocale, telegramUpdateSchema } from "@/features/notifications/telegram";
import { sendTelegramHtml } from "@/features/notifications/telegram-dispatch";
import { miniAppBaseUrl } from "@/lib/telegram/bot";
import { ensureTelegramProfile, normalizeContactPhone } from "@/features/auth/telegram-session";
import { botMenuKeyboard, continueAfterPhone, handleBotCallback, handleBotText, sendCvPdf, sendLanguagePicker, sendMatchingJobs, startCv, type BotCtx } from "@/features/bot/cv-bot";
import { logSecurityEvent } from "@/lib/security/events";
import type { createAdminClient as CreateAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function secretMatches(header: string | null, secret: string): boolean {
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

const UZ_PHONE = /^\+998\d{9}$/;

type Admin = ReturnType<typeof CreateAdmin>;
type TT = (key: string, params?: Record<string, string | number>) => string;
/** bog'lash tokeni (base64url, 43 belgi) — callback_data 64 bayt chegarasiga sig'adi */
const LINK_TOKEN = /^[A-Za-z0-9_-]{16,56}$/;

function linkHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * /start sub_<token> yoki "lnk:<token>" tugmasi: hisobni Telegram'ga bog'lash.
 * 1-qadam (preview): token ishlatilmaydi — qaysi hisob ekani (niqoblangan ism) ko'rsatilib, tasdiq so'raladi.
 * 2-qadam (confirm): token bir martalik iste'mol qilinadi; avvalgi Telegram bo'lsa — unga ogohlantirish yuboriladi.
 */
async function handleLink(admin: Admin, chatId: number, from: { id: number; username?: string; first_name?: string; last_name?: string; language_code?: string }, token: string, confirm: boolean, tt: TT) {
  const hash = linkHash(token);
  if (!confirm) {
    const { data: pv } = await admin.rpc("preview_telegram_link_token", { p_token_hash: hash, p_telegram_user_id: from.id });
    const r = (pv ?? {}) as { status?: string; name?: string; replaces_other?: boolean };
    if (r.status === "ok" || r.status === "already_linked") {
      const text = `${tt("link_confirm", { name: escapeHtml(r.name ?? "—") })}${r.replaces_other ? `\n\n${tt("link_confirm_replace")}` : ""}`;
      const keyboard: InlineKeyboard = {
        inline_keyboard: [[{ text: `✅ ${tt("link_confirm_button")}`, callback_data: `lnk:${token}` }], [{ text: tt("link_cancel_button"), callback_data: "lnkx" }]],
      };
      await sendTelegramMessage(chatId, text, keyboard);
      return;
    }
    const key = r.status === "used" ? "link_used" : r.status === "expired" ? "link_expired" : r.status === "linked_elsewhere" ? "link_elsewhere" : "link_invalid";
    await sendTelegramMessage(chatId, tt(key));
    return;
  }
  const { data: res } = await admin.rpc("consume_telegram_link_token", {
    p_token_hash: hash, p_telegram_user_id: from.id, p_username: from.username ?? undefined,
    p_first_name: from.first_name ?? undefined, p_last_name: from.last_name ?? undefined, p_language: from.language_code ?? undefined,
  });
  const r = (res ?? {}) as { status?: string; profile_id?: string; role?: string | null; previous_telegram_user_id?: number | null };
  if (r.status === "linked" && r.profile_id) {
    const { data: prof } = await admin.from("profiles").select("locale").eq("id", r.profile_id).maybeSingle();
    const t2 = makeT(resolveTelegramLocale([prof?.locale, from.language_code]));
    const text = escapeHtml(t2("notifications.telegram.link_ok")) + (r.role ? `\n${escapeHtml(t2(`notifications.telegram.subscribed_${r.role}`))}` : "");
    const sent = await sendTelegramHtml(chatId, text, {
      inline_keyboard: [[{ text: t2("notifications.telegram.settings_button"), web_app: { url: `${miniAppBaseUrl()}/cabinet/alerts` } }]],
    });
    if (sent.ok) await admin.rpc("confirm_match_subscription", { p_profile_id: r.profile_id, p_role: r.role ?? "" });
    // avvalgi Telegram egasi xabardor qilinadi (begona odam bog'lagan bo'lsa — darhol biladi)
    if (r.previous_telegram_user_id && r.previous_telegram_user_id !== from.id) {
      await sendTelegramHtml(r.previous_telegram_user_id, `⚠️ ${escapeHtml(t2("notifications.telegram.relinked_old"))}`).catch(() => null);
    }
    return;
  }
  const key = r.status === "used" ? "link_used" : r.status === "expired" ? "link_expired" : r.status === "linked_elsewhere" ? "link_elsewhere" : "link_invalid";
  await sendTelegramMessage(chatId, tt(key));
}

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

  // Telegram javobni kutmay qolsa bir update'ni qayta yuboradi — ikkinchi marta qayta ishlanmaydi (idempotent)
  try {
    const { data: first, error } = await createAdminClient().rpc("telegram_update_first_seen", { p_update_id: parsed.data.update_id });
    if (!error && first === false) return NextResponse.json({ ok: true, ignored: "duplicate" });
  } catch {
    // dedupe ishlamasa ham xabar qayta ishlanadi (yo'qotishdan takror yaxshi)
  }

  // ---------- inline tugma ----------
  const callback = parsed.data.callback_query;
  if (callback) {
    const chat = callback.message?.chat;
    if (callback.from.is_bot || !chat || chat.type !== "private" || !callback.data) return NextResponse.json({ ok: true, ignored: "callback" });
    try {
      const admin = createAdminClient();
      const { data: account } = await admin.from("telegram_accounts").select("language_code, profiles(locale, is_blocked)").eq("telegram_user_id", callback.from.id).maybeSingle();
      const locale = resolveTelegramLocale([account?.profiles?.locale, account?.language_code, callback.from.language_code]);
      const t = makeT(locale);
      const tt: TT = (key, params) => escapeHtml(t(`notifications.telegram.${key}`, params));
      // bog'lashni tasdiqlash / bekor qilish
      if (callback.data === "lnkx") {
        await answerCallback(callback.id);
        await sendTelegramMessage(chat.id, tt("link_cancelled"));
        return NextResponse.json({ ok: true, callback: "link_cancel" });
      }
      if (callback.data.startsWith("lnk:")) {
        await answerCallback(callback.id);
        const token = callback.data.slice(4);
        if (LINK_TOKEN.test(token)) await handleLink(admin, chat.id, callback.from, token, true, tt);
        return NextResponse.json({ ok: true, callback: "link" });
      }
      // bloklangan hisob bot orqali ma'lumot yoza olmaydi
      if (account?.profiles?.is_blocked) {
        await answerCallback(callback.id, t("common.errors.blocked"));
        return NextResponse.json({ ok: true, ignored: "blocked" });
      }
      const ctx: BotCtx = { admin, from: callback.from, chatId: chat.id, locale, t };
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
      .select("profile_id, language_code, phone, profiles(locale, is_blocked)")
      .eq("telegram_user_id", from.id)
      .maybeSingle();

    const locale = resolveTelegramLocale([account?.profiles?.locale, account?.language_code, from.language_code]);
    const t = makeT(locale);
    const tt = (key: string, params?: Record<string, string | number>) => escapeHtml(t(`notifications.telegram.${key}`, params));
    const bot: BotCtx = { admin, from, chatId, locale, t };

    if (account) {
      await admin
        .from("telegram_accounts")
        .update({ bot_started: true, last_seen_at: new Date().toISOString(), language_code: from.language_code ?? account.language_code, username: from.username ?? null })
        .eq("telegram_user_id", from.id);
    }

    // ---------- /start sub_<token>: xabarnomalar uchun hisobni xavfsiz bog'lash ----------
    // Token bir martalik va 15 daqiqa amal qiladi (faqat xeshi saqlanadi); chat_id tekshirilgan holda bog'lanadi,
    // username orqali emas. Avval qaysi hisob ekani ko'rsatilib tasdiq so'raladi (begona havola orqali tasodifiy bog'lanish yo'q).
    // Obuna faqat bot shu chatga xabar yetkaza olgandan keyin faollashadi.
    if (command?.name === "start" && command.param?.startsWith("sub_")) {
      const token = command.param.slice(4);
      if (LINK_TOKEN.test(token)) await handleLink(admin, chatId, from, token, false, tt);
      else await sendTelegramMessage(chatId, tt("link_invalid"));
      return NextResponse.json({ ok: true, start: "sub" });
    }

    // bloklangan hisob: bot orqali ma'lumot yozish (CV, raqam) yo'q
    if (account?.profiles?.is_blocked) {
      await sendTelegramMessage(chatId, escapeHtml(t("common.errors.blocked")));
      return NextResponse.json({ ok: true, ignored: "blocked" });
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
      const { data: prof } = await admin.from("profiles").select("is_blocked").eq("id", profileId).maybeSingle();
      if (prof?.is_blocked) {
        await sendTelegramMessage(chatId, escapeHtml(t("common.errors.blocked")), removeKeyboard);
        return NextResponse.json({ ok: true, ignored: "blocked" });
      }
      // raqam boshqa (eski) Telegram hisobida bo'lsa — undan olib qo'yiladi (raqam egasi o'zgargan: SIM qayta sotilgan)
      const { data: moved } = await admin
        .from("telegram_accounts")
        .update({ phone: null, phone_shared_at: null })
        .eq("phone", phone)
        .neq("telegram_user_id", from.id)
        .select("profile_id");
      if (moved?.length) {
        await logSecurityEvent({ type: "telegram.phone_moved", severity: "medium", reason: "phone_shared_by_other_account", actorId: profileId, route: "/api/telegram/webhook", details: { from_accounts: moved.length } });
      }
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
