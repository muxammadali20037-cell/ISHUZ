import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";
import { WEB_LOGIN_COOKIE, WEB_LOGIN_START_PREFIX, hashWebLoginToken, newWebLoginToken } from "@/features/auth/web-login";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Brauzerda kodsiz kirishni boshlaydi: bir martalik token → Telegram bot havolasi. Token cookie'da (faqat shu brauzer). */
export async function POST(req: NextRequest) {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME } = getServerEnv();
  const bot = TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  if (!TELEGRAM_BOT_TOKEN || !bot) return NextResponse.json({ error: "telegram_not_configured" }, { status: 503 });

  const token = newWebLoginToken();
  const admin = createAdminClient();
  // Eski so'rovlarni tozalash (arzon, indeks bo'yicha)
  await admin.from("web_login_requests").delete().lt("expires_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  const { error } = await admin.from("web_login_requests").insert({ token_hash: hashWebLoginToken(token), user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null });
  if (error) {
    console.error("[web login] start", error.message);
    return NextResponse.json({ error: "start_failed" }, { status: 500 });
  }
  const res = NextResponse.json({ ok: true, url: `https://t.me/${bot}?start=${WEB_LOGIN_START_PREFIX}${token}` });
  res.cookies.set(WEB_LOGIN_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/telegram/web", maxAge: 600 });
  return res;
}
