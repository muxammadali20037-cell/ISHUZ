import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LOCALE_COOKIE, LOCALES, type Locale } from "@/lib/i18n/config";
import { ensureTelegramProfile, startSessionForProfile, type TelegramIdentity } from "@/features/auth/telegram-session";
import { WEB_LOGIN_COOKIE, hashWebLoginToken, isWebLoginToken } from "@/features/auth/web-login";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Brauzer har 2 soniyada so'raydi: bot orqali tasdiqlandimi? Tasdiqlangan bo'lsa — sessiya ochiladi (bir marta).
 * Holatlar: pending | ok | expired.
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(WEB_LOGIN_COOKIE)?.value ?? "";
  if (!isWebLoginToken(token)) return NextResponse.json({ status: "expired" });
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("web_login_requests")
    .select("id, expires_at, confirmed_at, consumed_at, telegram_user_id, tg_user")
    .eq("token_hash", hashWebLoginToken(token))
    .maybeSingle();
  if (!row || row.consumed_at || new Date(row.expires_at).getTime() < Date.now()) return NextResponse.json({ status: "expired" });
  if (!row.confirmed_at || !row.telegram_user_id || !row.tg_user) return NextResponse.json({ status: "pending" });

  // Bir martalik: faqat birinchi so'rov sessiya oladi
  const { data: claimed } = await admin.from("web_login_requests").update({ consumed_at: new Date().toISOString() }).eq("id", row.id).is("consumed_at", null).select("id").maybeSingle();
  if (!claimed) return NextResponse.json({ status: "expired" });

  try {
    const tg = row.tg_user as unknown as TelegramIdentity;
    const raw = req.cookies.get(LOCALE_COOKIE)?.value;
    const locale = (LOCALES as readonly string[]).includes(raw ?? "") ? (raw as Locale) : undefined;
    const userId = await ensureTelegramProfile(admin, { ...tg, id: Number(row.telegram_user_id) }, locale);
    await startSessionForProfile(admin, userId, Number(row.telegram_user_id));
  } catch (e) {
    console.error("[web login] session", e instanceof Error ? e.message : e);
    // Vaqtinchalik xato — so'rov qayta urinish uchun ochiq qoladi
    await admin.from("web_login_requests").update({ consumed_at: null }).eq("id", row.id);
    return NextResponse.json({ status: "pending" });
  }
  const res = NextResponse.json({ status: "ok" });
  res.cookies.set(WEB_LOGIN_COOKIE, "", { path: "/api/auth/telegram/web", maxAge: 0 });
  return res;
}
