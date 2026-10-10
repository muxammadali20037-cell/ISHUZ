import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";
import { normalizePhone } from "@/lib/format";
import { makeT } from "@/lib/i18n/translate";
import { LOCALES } from "@/lib/i18n/config";
import { escapeHtml } from "@/lib/telegram/bot";
import { hitRate } from "@/lib/rate-limit";
import { readJsonBody, rejectUnsafeRequest } from "@/lib/security/guard";
import { clientIp, ipBucket, subjectHash } from "@/lib/security/request";
import { requestIdOf } from "@/lib/security/events";
import { activeRestriction, applyRuleHit } from "@/lib/security/restrictions";
import { RULES, blockingError, strongest } from "@/lib/security/rules";
import { sendTelegramHtml } from "@/features/notifications/telegram-dispatch";
import { isTelegramBlockedError, resolveTelegramLocale } from "@/features/notifications/telegram";
import { LOGIN_CODE_RESEND_SECONDS, LOGIN_CODE_TTL_SECONDS, generateLoginCode, hashLoginCode } from "@/features/auth/telegram-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/auth/phone-code/send";
/** bir vaqtda amal qiladigan kodlar (qayta yuborish oldingisini bekor qilmaydi — begona odam kodingizni "o'chira" olmaydi) */
const MAX_ACTIVE_CODES = 3;

/**
 * Saytda kirish: telefon raqamga bog'langan Telegram hisobiga bot orqali 6 xonali kod yuboradi.
 * Raqam hali botga ulashilmagan bo'lsa → 404 telegram_not_linked (UI botni ochishni taklif qiladi).
 * Limitlar atomik va fail-closed (DB javob bermasa — 503): telefon 6/soat, IP (/64) 30/soat.
 */
export async function POST(req: NextRequest) {
  const unsafe = rejectUnsafeRequest(req);
  if (unsafe) return unsafe;
  const { TELEGRAM_BOT_TOKEN } = getServerEnv();
  if (!TELEGRAM_BOT_TOKEN) return NextResponse.json({ error: "telegram_not_configured" }, { status: 503 });

  const body = z.object({ phone: z.string().max(32), locale: z.enum(LOCALES).optional() }).safeParse(await readJsonBody(req));
  const phone = body.success ? normalizePhone(body.data.phone) : null;
  if (!phone) return NextResponse.json({ error: "invalid_phone" }, { status: 400 });

  const requestId = requestIdOf(req.headers);
  const ip = ipBucket(clientIp(req.headers));
  const phoneHash = subjectHash("phone", phone);
  const ipHash = subjectHash("ip", ip);

  try {
    // majburiy rejimdagi faol cheklov (kuzatuv rejimida to'xtatmaydi)
    const restriction = strongest(await activeRestriction("phone", phoneHash), await activeRestriction("ip", ipHash));
    const blocked = blockingError(restriction);
    if (blocked) return NextResponse.json({ error: blocked }, { status: 429 });

    const [byPhone, byIp] = await Promise.all([hitRate(`otp:send:phone:${phoneHash}`, 6, 3600), hitRate(`otp:send:ip:${ipHash}`, 30, 3600)]);
    if ("count" in byIp) await applyRuleHit(RULES.otpSendPerIp, byIp.count, { subject: ipHash, subjectHash: ipHash, route: ROUTE, requestId });
    if ((!byPhone.ok && byPhone.reason === "unavailable") || (!byIp.ok && byIp.reason === "unavailable")) {
      return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
    }
    if (!byPhone.ok || !byIp.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

    const admin = createAdminClient();
    const { data: account } = await admin
      .from("telegram_accounts")
      .select("telegram_user_id, language_code, profiles(locale, is_blocked)")
      .eq("phone", phone)
      .maybeSingle();
    if (!account) return NextResponse.json({ error: "telegram_not_linked" }, { status: 404 });
    if (account.profiles?.is_blocked) return NextResponse.json({ error: "blocked" }, { status: 403 });

    const nowIso = new Date().toISOString();
    const { data: active } = await admin
      .from("login_codes")
      .select("id, created_at")
      .eq("phone", phone)
      .is("consumed_at", null)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(MAX_ACTIVE_CODES + 5);
    const list = active ?? [];
    if (list[0] && new Date(list[0].created_at).getTime() > Date.now() - LOGIN_CODE_RESEND_SECONDS * 1000) {
      return NextResponse.json({ error: "wait_before_resend" }, { status: 429 });
    }
    // eng eski ortiqcha kodlar bekor qilinadi (oxirgi MAX_ACTIVE_CODES - 1 tasi + yangisi amal qiladi)
    const stale = list.slice(MAX_ACTIVE_CODES - 1).map((r) => r.id);
    if (stale.length) await admin.from("login_codes").update({ consumed_at: nowIso }).in("id", stale);

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
    if (insErr || !row) throw new Error(`login_codes insert: ${insErr?.code ?? "unknown"}`);

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
    console.error("[phone-code send]", e instanceof Error ? e.message : "error");
    return NextResponse.json({ error: "otp_send_failed" }, { status: 500 });
  }
}
