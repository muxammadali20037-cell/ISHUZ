import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeHtml, openAppKeyboard, removeKeyboard, sendTelegramMessage, shareContactKeyboard } from "@/lib/telegram/bot";
import { makeT } from "@/lib/i18n/translate";
import { formatPhone } from "@/lib/format";
import { parseBotCommand, resolveTelegramLocale, telegramUpdateSchema } from "@/features/notifications/telegram";
import { ensureTelegramProfile, normalizeContactPhone } from "@/features/auth/telegram-session";

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
 * Har doim 200 (Telegram qayta yubormasin).
 */
export async function POST(req: NextRequest) {
  const { TELEGRAM_WEBHOOK_SECRET } = getServerEnv();
  if (!TELEGRAM_WEBHOOK_SECRET || !secretMatches(req.headers.get("x-telegram-bot-api-secret-token"), TELEGRAM_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = telegramUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: true, ignored: "unparsable" });
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
      await sendTelegramMessage(chatId, tt("hint"), openAppKeyboard(t("notifications.telegram.open_app"), "/"));
      return NextResponse.json({ ok: true, contact: "linked" });
    }

    // ---------- /start va boshqa matnlar ----------
    const isStart = command?.name === "start";
    const text = isStart ? `${tt("welcome")}\n\n${tt("hint")}` : tt("hint");
    await sendTelegramMessage(chatId, text, openAppKeyboard(t("notifications.telegram.open_app"), "/"));

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
