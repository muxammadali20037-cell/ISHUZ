import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";
import { normalizePhone } from "@/lib/format";
import { makeT } from "@/lib/i18n/translate";
import { LOCALES } from "@/lib/i18n/config";
import { escapeHtml } from "@/lib/telegram/bot";
import { sendTelegramHtml } from "@/features/notifications/telegram-dispatch";
import { isTelegramBlockedError, resolveTelegramLocale } from "@/features/notifications/telegram";
import { LOGIN_CODE_RESEND_SECONDS, LOGIN_CODE_TTL_SECONDS, generateLoginCode, hashLoginCode } from "@/features/auth/telegram-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Saytda kirish: telefon raqamga bog'langan Telegram hisobiga bot orqali 6 xonali kod yuboradi.
 * Raqam hali botga ulashilmagan bo'lsa → 404 telegram_not_linked (UI botni ochishni taklif qiladi).
 */
export async function POST(req: NextRequest) {
  const { TELEGRAM_BOT_TOKEN } = getServerEnv();
  if (!TELEGRAM_BOT_TOKEN) return NextResponse.json({ error: "telegram_not_configured" }, { status: 503 });

  const body = z.object({ phone: z.string().max(32), locale: z.enum(LOCALES).optional() }).safeParse(await req.json().catch(() => null));
  const phone = body.success ? normalizePhone(body.data.phone) : null;
  if (!phone) return NextResponse.json({ error: "invalid_phone" }, { status: 400 });

  try {
    const admin = createAdminClient();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const [byPhone, byIp] = await Promise.all([
      admin.rpc("check_rate_limit", { p_key: `tgcode:phone:${phone}`, p_limit: 6, p_window_seconds: 3600 }),
      admin.rpc("check_rate_limit", { p_key: `tgcode:ip:${ip}`, p_limit: 30, p_window_seconds: 3600 }),
    ]);
    if (byPhone.data === false || byIp.data === false) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

    const { data: account } = await admin
      .from("telegram_accounts")
      .select("telegram_user_id, language_code, profiles(locale)")
      .eq("phone", phone)
      .maybeSingle();
    if (!account) return NextResponse.json({ error: "telegram_not_linked" }, { status: 404 });

    const { data: recent } = await admin
      .from("login_codes")
      .select("created_at")
      .eq("phone", phone)
      .is("consumed_at", null)
      .gt("created_at", new Date(Date.now() - LOGIN_CODE_RESEND_SECONDS * 1000).toISOString())
      .limit(1)
      .maybeSingle();
    if (recent) return NextResponse.json({ error: "wait_before_resend" }, { status: 429 });

    // eski kodlar bekor qilinadi — faqat oxirgisi amal qiladi
    await admin.from("login_codes").update({ consumed_at: new Date().toISOString() }).eq("phone", phone).is("consumed_at", null);

    const code = generateLoginCode();
    const { data: row, error: insErr } = await admin
      .from("login_codes")
      .insert({
        telegram_user_id: account.telegram_user_id,
        phone,
        code_hash: hashLoginCode(phone, code),
        expires_at: new Date(Date.now() + LOGIN_CODE_TTL_SECONDS * 1000).toISOString(),
      })
      .select("id")
      .single();
    if (insErr || !row) throw new Error(`login_codes insert: ${insErr?.message}`);

    const locale = resolveTelegramLocale([account.profiles?.locale, body.success ? body.data.locale : null, account.language_code]);
    const t = makeT(locale);
    const html = `🔐 ${escapeHtml(t("notifications.telegram.login_code_title"))}: <code>${code}</code>\n\n${escapeHtml(t("notifications.telegram.login_code_warning"))}`;
    const sent = await sendTelegramHtml(account.telegram_user_id, html);
    if (!sent.ok) {
      await admin.from("login_codes").delete().eq("id", row.id);
      if (isTelegramBlockedError(sent.code, sent.description)) {
        await admin.from("telegram_accounts").update({ bot_started: false }).eq("telegram_user_id", account.telegram_user_id);
        return NextResponse.json({ error: "telegram_blocked" }, { status: 409 });
      }
      return NextResponse.json({ error: "otp_send_failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, ttl: LOGIN_CODE_TTL_SECONDS });
  } catch (e) {
    console.error("[phone-code send]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "otp_send_failed" }, { status: 500 });
  }
}
