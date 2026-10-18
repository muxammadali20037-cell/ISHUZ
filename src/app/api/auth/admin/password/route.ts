import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminUiEnabled } from "@/lib/features";
import { hitRate } from "@/lib/rate-limit";
import { readJsonBody, rejectUnsafeRequest } from "@/lib/security/guard";
import { clientIp, ipBucket, subjectHash } from "@/lib/security/request";
import { logSecurityEvent, requestIdOf } from "@/lib/security/events";
import { activeRestriction } from "@/lib/security/restrictions";
import { blockingError } from "@/lib/security/rules";
import { ADMIN_PASSWORD_MAX, normalizeEmail } from "@/features/auth/admin-login";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/auth/admin/password";

/**
 * Admin zaxira kirishi: email + parol → sessiya (aal1). Panel huquqlari baribir faqat autentifikator kodidan keyin (aal2) —
 * buni baza (admin_aal_ok) va /admin/mfa ta'minlaydi. Faqat faol, bloklanmagan admin kiradi: boshqa hisob (masalan,
 * ochiq ro'yxatdan o'tib parol qo'ygan) shu yo'l bilan kirsa — sessiya darhol yopiladi va umumiy xato qaytadi.
 * Limitlar fail-closed: email 10 / 15 daqiqa, IP (/64) 30 / soat. Xato javobi bitta: hisob borligi bildirilmaydi.
 */
export async function POST(req: NextRequest) {
  const unsafe = rejectUnsafeRequest(req);
  if (unsafe) return unsafe;
  if (!adminUiEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = z.object({ email: z.string().max(254), password: z.string().min(1).max(ADMIN_PASSWORD_MAX) }).safeParse(await readJsonBody(req));
  const email = body.success ? normalizeEmail(body.data.email) : null;
  if (!body.success || !email) return NextResponse.json({ error: "invalid_credentials" }, { status: 400 });

  const requestId = requestIdOf(req.headers);
  const ipHash = subjectHash("ip", ipBucket(clientIp(req.headers)));
  const emailHash = subjectHash("email", email);

  try {
    const blocked = blockingError(await activeRestriction("ip", ipHash));
    if (blocked) return NextResponse.json({ error: blocked }, { status: 429 });
    const [byEmail, byIp] = await Promise.all([hitRate(`admin_pw:email:${emailHash}`, 10, 900), hitRate(`admin_pw:ip:${ipHash}`, 30, 3600)]);
    if ((!byEmail.ok && byEmail.reason === "unavailable") || (!byIp.ok && byIp.reason === "unavailable")) {
      return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
    }
    if (!byEmail.ok || !byIp.ok) {
      await logSecurityEvent({ type: "auth.admin_password_rate_limited", severity: "medium", reason: byEmail.ok ? "ip" : "email", subjectHash: byEmail.ok ? ipHash : emailHash, route: ROUTE, action: "throttled", requestId });
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: body.data.password });
    if (error || !data.user) {
      const code = error?.code ?? "invalid_credentials";
      await logSecurityEvent({ type: "auth.admin_password_failed", severity: "low", reason: /^[a-z0-9_.]{1,64}$/.test(code) ? code : "invalid_credentials", subjectHash: emailHash, route: ROUTE, action: "logged", requestId });
      // Supabase'da email bilan kirish o'chirilgan — sozlash kerak (hisob haqida hech narsa bildirmaydi)
      if (code === "email_provider_disabled") return NextResponse.json({ error: "password_login_disabled" }, { status: 503 });
      return NextResponse.json({ error: "invalid_credentials" }, { status: 400 });
    }

    const admin = createAdminClient();
    const [{ data: row }, { data: profile }] = await Promise.all([
      admin.from("admin_users").select("is_active").eq("profile_id", data.user.id).maybeSingle(),
      admin.from("profiles").select("is_blocked").eq("id", data.user.id).maybeSingle(),
    ]);
    if (!row?.is_active || !profile || profile.is_blocked) {
      await supabase.auth.signOut({ scope: "local" });
      await logSecurityEvent({ type: "auth.admin_password_not_admin", severity: "medium", reason: profile?.is_blocked ? "blocked_account" : "not_active_admin", actorId: data.user.id, route: ROUTE, action: "blocked", requestId });
      return NextResponse.json({ error: "invalid_credentials" }, { status: 400 });
    }
    await logSecurityEvent({ type: "auth.admin_password_login", severity: "info", reason: "password", actorId: data.user.id, route: ROUTE, action: "logged", requestId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin password]", e instanceof Error ? e.message : "error");
    return NextResponse.json({ error: "auth_failed" }, { status: 500 });
  }
}
