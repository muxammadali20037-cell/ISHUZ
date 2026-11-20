import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { allowRate } from "@/lib/rate-limit";
import { clientIp, ipBucket, subjectHash } from "@/lib/security/request";
import { logSecurityEvent } from "@/lib/security/events";
import { safeInternalPath } from "@/lib/security/safe-path";
import { AccountBlockedError, startSessionForProfile } from "@/features/auth/telegram-session";
import { HANDOFF_PARAM } from "@/features/auth/telegram-web-handoff";
import { sha256hex } from "@/features/auth/telegram-web-login";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Botdagi "Ochish" (Telegram orqali kirish tasdiqlangach): bir martalik havola — shu brauzerda sessiya ochiladi va sayt
 * (sukut — asosiy ekran /chat) ochiladi. Havola eskirgan yoki ishlatilgan bo'lsa — kirish sahifasi (u yerdan qayta kiriladi).
 * GET: Telegram tugmasi oddiy havola ochadi. Javob keshlanmaydi; manzil tarixda qolmasin — darhol yo'naltiriladi.
 */
export async function GET(req: NextRequest) {
  const to = safeInternalPath(req.nextUrl.searchParams.get("to"), "/chat") || "/chat";
  const fail = () => {
    const res = NextResponse.redirect(new URL(`/auth?${new URLSearchParams({ next: to }).toString()}`, req.url), 303);
    res.headers.set("Cache-Control", "no-store");
    return res;
  };
  const m = HANDOFF_PARAM.exec(req.nextUrl.searchParams.get("r") ?? "");
  if (!m) return fail();

  const ipHash = subjectHash("ip", ipBucket(clientIp(req.headers)));
  if (!(await allowRate(`tgweb:open:ip:${ipHash}`, 60, 3600))) return fail();

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("telegram_web_login_consume", { p_id: m[1]!, p_browser_hash: sha256hex(m[2]!) });
  const row = data?.[0];
  if (error || !row || row.status !== "ok" || !row.profile_id || !row.telegram_user_id) return fail();

  try {
    await startSessionForProfile(admin, row.profile_id, Number(row.telegram_user_id));
  } catch (e) {
    if (e instanceof AccountBlockedError) {
      const res = NextResponse.redirect(new URL("/blocked", req.url), 303);
      res.headers.set("Cache-Control", "no-store");
      return res;
    }
    await logSecurityEvent({ type: "auth.telegram_web_login_failed", severity: "medium", reason: e instanceof Error ? e.message.slice(0, 120) : "unknown", route: "/api/auth/telegram-web/open", action: "logged" }).catch(() => null);
    return fail();
  }
  const res = NextResponse.redirect(new URL(to, req.url), 303);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
