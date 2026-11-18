import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { hitRate } from "@/lib/rate-limit";
import { rejectUnsafeRequest } from "@/lib/security/guard";
import { clientIp, ipBucket, subjectHash } from "@/lib/security/request";
import {
  WEB_LOGIN_COOKIE,
  WEB_LOGIN_COOKIE_PATH,
  WEB_LOGIN_START_PREFIX,
  WEB_LOGIN_TTL_SECONDS,
  newSecret,
  sha256hex,
  shortUserAgent,
} from "@/features/auth/telegram-web-login";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Telegram orqali kodsiz kirish — 1-qadam (0085). Bir martalik so'rov yaratiladi: token — Telegram havolasida
 * (`t.me/<bot>?start=w_<token>`), brauzer kaliti — httpOnly cookie'da; bazada faqat xeshlari. IP bo'yicha soatiga 30 ta.
 * Bot yoki 0085 sozlanmagan bo'lsa — 503 (sahifa eski usulga qaytadi: bot ochiladi, ilova tugmasi).
 */
export async function POST(req: NextRequest) {
  const unsafe = rejectUnsafeRequest(req);
  if (unsafe) return unsafe;
  const { TELEGRAM_BOT_USERNAME, TELEGRAM_BOT_TOKEN } = getServerEnv();
  const bot = TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  if (!bot || !TELEGRAM_BOT_TOKEN || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const ipHash = subjectHash("ip", ipBucket(clientIp(req.headers)));
  const rate = await hitRate(`tgweb:start:ip:${ipHash}`, 30, 3600);
  if (!rate.ok) return NextResponse.json({ error: rate.reason === "unavailable" ? "temporarily_unavailable" : "rate_limited" }, { status: rate.reason === "unavailable" ? 503 : 429 });

  const token = newSecret();
  const nonce = newSecret();
  const { data: id, error } = await createAdminClient().rpc("telegram_web_login_create", {
    p_token_hash: sha256hex(token),
    p_browser_hash: sha256hex(nonce),
    p_user_agent: shortUserAgent(req.headers.get("user-agent")),
  });
  if (error || !id) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  const res = NextResponse.json({ url: `https://t.me/${bot}?start=${WEB_LOGIN_START_PREFIX}${token}`, ttl: WEB_LOGIN_TTL_SECONDS });
  res.cookies.set(WEB_LOGIN_COOKIE, `${id}.${nonce}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && !req.nextUrl.hostname.match(/^(localhost|127\.0\.0\.1)$/),
    sameSite: "lax",
    path: WEB_LOGIN_COOKIE_PATH,
    maxAge: WEB_LOGIN_TTL_SECONDS + 60,
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
