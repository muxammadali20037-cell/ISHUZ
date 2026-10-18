import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminUiEnabled } from "@/lib/features";
import { hitRate } from "@/lib/rate-limit";
import { readJsonBody, rejectUnsafeRequest } from "@/lib/security/guard";
import { clientIp, ipBucket, subjectHash } from "@/lib/security/request";
import { logSecurityEvent, requestIdOf } from "@/lib/security/events";
import { normalizeEmail } from "@/features/auth/admin-login";
import { attachOwnerEmail, findActiveAdminByEmail, sendAdminLink } from "@/features/auth/admin-password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/auth/admin/recover";

/**
 * Parol o'rnatish / tiklash havolasi (Supabase emaili). Faqat faol adminga biriktirilgan email yoki egasining
 * SUPER_ADMIN_EMAILS dagi emailiga yuboriladi. Javob doim bir xil — email kimniki ekani bildirilmaydi.
 * Havola kirish sessiyasini ochadi (aal1); panelga — baribir autentifikator kodi bilan, parol — panel ichida o'rnatiladi.
 * Limitlar: email 3 / soat, IP (/64) 10 / soat (Supabase'ning o'z email limiti ham bor).
 */
export async function POST(req: NextRequest) {
  const unsafe = rejectUnsafeRequest(req);
  if (unsafe) return unsafe;
  if (!adminUiEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = z.object({ email: z.string().max(254) }).safeParse(await readJsonBody(req));
  const email = body.success ? normalizeEmail(body.data.email) : null;
  if (!email) return NextResponse.json({ error: "invalid_email" }, { status: 400 });

  const requestId = requestIdOf(req.headers);
  const ipHash = subjectHash("ip", ipBucket(clientIp(req.headers)));
  const emailHash = subjectHash("email", email);

  try {
    const [byEmail, byIp] = await Promise.all([hitRate(`admin_link:email:${emailHash}`, 3, 3600), hitRate(`admin_link:ip:${ipHash}`, 10, 3600)]);
    if ((!byEmail.ok && byEmail.reason === "unavailable") || (!byIp.ok && byIp.reason === "unavailable")) {
      return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
    }
    if (!byEmail.ok || !byIp.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

    const admin = createAdminClient();
    const profileId = (await findActiveAdminByEmail(admin, email)) ?? (await attachOwnerEmail(admin, email, requestId));
    if (!profileId) {
      await logSecurityEvent({ type: "auth.admin_link_unknown", severity: "low", reason: "no_admin_email", subjectHash: emailHash, route: ROUTE, action: "logged", requestId });
      return NextResponse.json({ ok: true });
    }
    const sent = await sendAdminLink(email);
    await logSecurityEvent({
      type: sent.ok ? "auth.admin_link_sent" : "auth.admin_link_send_failed",
      severity: sent.ok ? "info" : "medium",
      reason: sent.ok ? "email" : /^[a-z0-9_.]{1,64}$/.test(sent.code) ? sent.code : "send_failed",
      actorId: profileId,
      route: ROUTE,
      action: "logged",
      requestId,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin recover]", e instanceof Error ? e.message : "error");
    return NextResponse.json({ error: "auth_failed" }, { status: 500 });
  }
}
