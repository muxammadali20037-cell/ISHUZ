import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { allowRate } from "@/lib/rate-limit";
import { rejectUnsafeRequest } from "@/lib/security/guard";
import { clientIp, ipBucket, subjectHash } from "@/lib/security/request";
import { logSecurityEvent } from "@/lib/security/events";
import { AccountBlockedError, startSessionForProfile } from "@/features/auth/telegram-session";
import { WEB_LOGIN_COOKIE, WEB_LOGIN_COOKIE_PATH, parseWebLoginCookie, sha256hex } from "@/features/auth/telegram-web-login";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Telegram orqali kodsiz kirish — 2-qadam (0085): brauzer har 2 soniyada so'raydi. Bot "✅ Kirish" bosilgan bo'lsa —
 * so'rov atomik ishlatiladi (faqat o'sha brauzer kaliti bilan) va sessiya cookie'lari shu javobga yoziladi.
 * Javob: { status: pending | ok | expired | used | invalid | blocked | unavailable }.
 */
export async function POST(req: NextRequest) {
  const unsafe = rejectUnsafeRequest(req);
  if (unsafe) return unsafe;
  const parsed = parseWebLoginCookie(req.cookies.get(WEB_LOGIN_COOKIE)?.value);
  const done = (status: string, code = 200) => {
    const res = NextResponse.json({ status }, { status: code });
    res.headers.set("Cache-Control", "no-store");
    if (status !== "pending" && status !== "unavailable") res.cookies.set(WEB_LOGIN_COOKIE, "", { path: WEB_LOGIN_COOKIE_PATH, maxAge: 0 });
    return res;
  };
  if (!parsed) return done("invalid");

  // so'rov tez-tez (2 s) — IP bo'yicha keng chegara (5 daqiqada ~150 ta); fail-open
  const ipHash = subjectHash("ip", ipBucket(clientIp(req.headers)));
  if (!(await allowRate(`tgweb:status:ip:${ipHash}`, 900, 3600))) return done("unavailable", 429);

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("telegram_web_login_consume", { p_id: parsed.id, p_browser_hash: sha256hex(parsed.nonce) });
  if (error) return done("unavailable", 503);
  const row = data?.[0];
  if (!row || row.status !== "ok") return done(row?.status ?? "invalid");
  if (!row.profile_id || !row.telegram_user_id) return done("invalid");

  try {
    await startSessionForProfile(admin, row.profile_id, Number(row.telegram_user_id));
  } catch (e) {
    if (e instanceof AccountBlockedError) return done("blocked", 403);
    await logSecurityEvent({ type: "auth.telegram_web_login_failed", severity: "medium", reason: e instanceof Error ? e.message.slice(0, 120) : "unknown", route: "/api/auth/telegram-web/status", action: "logged" }).catch(() => null);
    return done("unavailable", 503);
  }
  return done("ok");
}
