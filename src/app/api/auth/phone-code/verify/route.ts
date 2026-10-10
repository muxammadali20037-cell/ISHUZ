import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/format";
import { hitRate } from "@/lib/rate-limit";
import { readJsonBody, rejectUnsafeRequest } from "@/lib/security/guard";
import { clientIp, ipBucket, subjectHash } from "@/lib/security/request";
import { logSecurityEvent, requestIdOf } from "@/lib/security/events";
import { activeRestriction, applyRuleHit } from "@/lib/security/restrictions";
import { RULES, blockingError, strongest } from "@/lib/security/rules";
import { LOGIN_CODE_MAX_ATTEMPTS, loginCodeMatches, startSessionForProfile } from "@/features/auth/telegram-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/auth/phone-code/verify";

/**
 * Telegram orqali yuborilgan kodni tekshiradi va sessiya ochadi (cookie).
 * - Faqat noto'g'ri urinishlar sanaladi (begona odam jabrlanuvchining limitini "yeb" qo'ya olmaydi), atomik hisoblagich bilan.
 * - Telefon bo'yicha har LOGIN_CODE_MAX_ATTEMPTS xatodan keyin faol kodlar bekor qilinadi (qayta so'rash — 6/soat).
 * - IP (/64) bo'yicha ham umumiy limit (ko'p raqamni sinash).
 */
export async function POST(req: NextRequest) {
  const unsafe = rejectUnsafeRequest(req);
  if (unsafe) return unsafe;
  const body = z.object({ phone: z.string().max(32), code: z.string().regex(/^\d{6}$/) }).safeParse(await readJsonBody(req));
  const phone = body.success ? normalizePhone(body.data.phone) : null;
  if (!body.success || !phone) return NextResponse.json({ error: "invalid_code" }, { status: 400 });

  const requestId = requestIdOf(req.headers);
  const ip = ipBucket(clientIp(req.headers));
  const phoneHash = subjectHash("phone", phone);
  const ipHash = subjectHash("ip", ip);

  try {
    const blocked = blockingError(strongest(await activeRestriction("phone", phoneHash), await activeRestriction("ip", ipHash)));
    if (blocked) return NextResponse.json({ error: blocked }, { status: 429 });

    const byIp = await hitRate(`otp:verify:ip:${ipHash}`, 60, 3600);
    if (!byIp.ok) return NextResponse.json({ error: byIp.reason === "unavailable" ? "temporarily_unavailable" : "rate_limited" }, { status: byIp.reason === "unavailable" ? 503 : 429 });

    const admin = createAdminClient();
    const { data: rows } = await admin
      .from("login_codes")
      .select("id, telegram_user_id, code_hash, attempts, expires_at")
      .eq("phone", phone)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(3);
    const active = (rows ?? []).filter((r) => r.attempts < LOGIN_CODE_MAX_ATTEMPTS);
    if (!active.length) return NextResponse.json({ error: "code_expired" }, { status: 400 });

    // har bir faol kod bilan doimiy vaqtda solishtiriladi
    const matched = active.map((r) => (loginCodeMatches(phone, body.data.code, r.code_hash) ? r : null)).find(Boolean) ?? null;

    if (!matched) {
      const [byPhoneFail, byIpFail] = await Promise.all([
        hitRate(`otp:fail:phone:${phoneHash}`, Number.MAX_SAFE_INTEGER, RULES.otpVerifyFailuresPerPhone.windowSeconds),
        hitRate(`otp:fail:ip:${ipHash}`, Number.MAX_SAFE_INTEGER, RULES.otpVerifyFailuresPerIp.windowSeconds),
      ]);
      const newest = active[0]!;
      // hisoblagich noma'lum bo'lsa (-1 yoki DB xatosi) — eng yangi kodning urinishlari bo'yicha
      const failCount = "count" in byPhoneFail && byPhoneFail.count > 0 ? byPhoneFail.count : newest.attempts + 1;
      if ("count" in byPhoneFail) await applyRuleHit(RULES.otpVerifyFailuresPerPhone, byPhoneFail.count, { subject: phoneHash, subjectHash: phoneHash, route: ROUTE, requestId });
      if ("count" in byIpFail) await applyRuleHit(RULES.otpVerifyFailuresPerIp, byIpFail.count, { subject: ipHash, subjectHash: ipHash, route: ROUTE, requestId });
      await admin.from("login_codes").update({ attempts: newest.attempts + 1 }).eq("id", newest.id);
      // har N xatoda faol kodlar yopiladi (DB hisoblagichi atomik — parallel urinishlar ham sanaladi)
      if (failCount % LOGIN_CODE_MAX_ATTEMPTS === 0) {
        await admin.from("login_codes").update({ consumed_at: new Date().toISOString() }).eq("phone", phone).is("consumed_at", null);
        return NextResponse.json({ error: "code_expired" }, { status: 400 });
      }
      return NextResponse.json({ error: "invalid_code" }, { status: 400 });
    }

    // bir marta ishlatish: parallel so'rovlardan faqat bittasi o'tadi; qolgan faol kodlar ham yopiladi
    const nowIso = new Date().toISOString();
    const { data: consumed } = await admin.from("login_codes").update({ consumed_at: nowIso }).eq("id", matched.id).is("consumed_at", null).select("id");
    if (!consumed?.length) return NextResponse.json({ error: "code_expired" }, { status: 400 });
    await admin.from("login_codes").update({ consumed_at: nowIso }).eq("phone", phone).is("consumed_at", null);

    const { data: account } = await admin
      .from("telegram_accounts")
      .select("profile_id, phone, profiles(is_blocked)")
      .eq("telegram_user_id", matched.telegram_user_id)
      .maybeSingle();
    if (!account || account.phone !== phone) return NextResponse.json({ error: "code_expired" }, { status: 400 });
    if (account.profiles?.is_blocked) {
      await logSecurityEvent({ type: "auth.blocked_login", severity: "low", reason: "blocked_account", actorId: account.profile_id, route: ROUTE, action: "blocked", requestId });
      return NextResponse.json({ error: "blocked" }, { status: 403 });
    }

    await startSessionForProfile(admin, account.profile_id, matched.telegram_user_id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[phone-code verify]", e instanceof Error ? e.message : "error");
    return NextResponse.json({ error: "auth_failed" }, { status: 500 });
  }
}
