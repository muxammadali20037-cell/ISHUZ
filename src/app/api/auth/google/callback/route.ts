import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { allowRate } from "@/lib/rate-limit";
import { clientIp, ipBucket, subjectHash } from "@/lib/security/request";
import { logSecurityEvent } from "@/lib/security/events";
import { safeInternalPath } from "@/lib/security/safe-path";
import { LOCALE_COOKIE, LOCALES } from "@/lib/i18n/config";
import { isExternalAvatar, namesFromGoogle } from "@/features/auth/google-profile";
import type { Database } from "@/types/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/auth/google/callback";

const go = (req: NextRequest, to: string) => {
  const res = NextResponse.redirect(new URL(to, req.url), 303);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
};

/**
 * Google orqali kirish (ega, 2026-11-26): Google → Supabase → shu yerga `?code=` bilan qaytadi. Kod shu brauzerdagi
 * PKCE kaliti bilan sessiyaga almashtiriladi (boshqa brauzerda ishlamaydi), keyin `next` ga (sukut — /start: yangi
 * foydalanuvchi rol va profilga). Yangi hisobga Google'dagi ism qo'yiladi; Google rasmi olinmaydi; email yopiq qoladi.
 * Bloklangan hisob — chiqariladi va /blocked. Xato yoki bekor qilinsa — kirish sahifasi xabar bilan.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const to = safeInternalPath(sp.get("next"), "/start") || "/start";
  const back = () => go(req, `/auth?${new URLSearchParams({ next: to, role: "1", google: "failed" }).toString()}`);
  const code = sp.get("code");
  if (sp.get("error") || !code || code.length > 512) {
    if (sp.get("error") && sp.get("error") !== "access_denied") {
      await logSecurityEvent({ type: "auth.google_login_failed", severity: "low", reason: (sp.get("error") ?? "").slice(0, 60), route: ROUTE, action: "logged" }).catch(() => null);
    }
    return back();
  }

  const ipHash = subjectHash("ip", ipBucket(clientIp(req.headers)));
  if (!(await allowRate(`google:cb:ip:${ipHash}`, 60, 3600))) return back();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  const user = data?.user;
  if (error || !user) {
    await logSecurityEvent({ type: "auth.google_login_failed", severity: "medium", reason: (error?.code ?? error?.message ?? "no_user").slice(0, 60), route: ROUTE, action: "logged" }).catch(() => null);
    return back();
  }

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("first_name, last_name, avatar_url, is_blocked").eq("id", user.id).maybeSingle();
  if (!profile) {
    await supabase.auth.signOut();
    return back();
  }
  if (profile.is_blocked) {
    await supabase.auth.signOut();
    return go(req, "/blocked");
  }

  // yangi hisob: Google'dagi ism; Google rasmi (handle_new_user avatar_url'dan olgan) — olib tashlanadi; til — sayt tili
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const patch: Database["public"]["Tables"]["profiles"]["Update"] = {};
  if (!profile.first_name?.trim()) {
    const names = namesFromGoogle(meta);
    if (names) {
      patch.first_name = names.first;
      if (!profile.last_name?.trim()) patch.last_name = names.last;
    }
  }
  if (isExternalAvatar(profile.avatar_url) && (profile.avatar_url === meta.avatar_url || profile.avatar_url === meta.picture)) patch.avatar_url = null;
  const isNew = Date.now() - new Date(user.created_at).getTime() < 10 * 60_000;
  const locale = req.cookies.get(LOCALE_COOKIE)?.value;
  if (isNew && locale && (LOCALES as readonly string[]).includes(locale)) patch.locale = locale as Database["public"]["Enums"]["app_locale"];
  if (Object.keys(patch).length) await admin.from("profiles").update(patch).eq("id", user.id);

  await logSecurityEvent({ type: "auth.google_login", severity: "info", reason: isNew ? "new" : "returning", actorId: user.id, route: ROUTE }).catch(() => null);
  return go(req, to);
}
