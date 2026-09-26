import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeHtml, openAppKeyboard, sendTelegramMessage } from "@/lib/telegram/bot";
import { makeT } from "@/lib/i18n/translate";
import { parseBotCommand, resolveTelegramLocale, telegramUpdateSchema } from "@/features/notifications/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function secretMatches(header: string | null, secret: string): boolean {
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Telegram Bot webhook (setWebhook secret_token bilan).
 * /start → tilga mos salomlashish + "Ilovani ochish" (web_app) tugmasi; telegram_accounts.bot_started = true.
 * Boshqa matn → qisqa ko'rsatma + tugma. Message bo'lmagan update'lar e'tiborsiz. Har doim 200 (Telegram qayta yubormasin).
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
  const command = parseBotCommand(message.text);

  try {
    const admin = createAdminClient();
    const { data: account } = await admin
      .from("telegram_accounts")
      .select("profile_id, language_code, bot_started, profiles(locale)")
      .eq("telegram_user_id", from.id)
      .maybeSingle();

    const locale = resolveTelegramLocale([account?.profiles?.locale, account?.language_code, from.language_code]);
    const t = makeT(locale);

    if (account) {
      await admin
        .from("telegram_accounts")
        .update({
          bot_started: true,
          last_seen_at: new Date().toISOString(),
          language_code: from.language_code ?? account.language_code,
          username: from.username ?? null,
        })
        .eq("telegram_user_id", from.id);
    }

    const isStart = command?.name === "start";
    const text = isStart ? `${escapeHtml(t("notifications.telegram.welcome"))}\n\n${escapeHtml(t("notifications.telegram.hint"))}` : escapeHtml(t("notifications.telegram.hint"));
    await sendTelegramMessage(message.chat.id, text, openAppKeyboard(t("notifications.telegram.open_app"), "/"));

    return NextResponse.json({ ok: true, command: command?.name ?? null, linked: !!account });
  } catch (e) {
    console.error("[telegram webhook]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: true, error: "internal" });
  }
}
