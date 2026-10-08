import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n/config";
import { ANDROID_APP, APP_COOKIE, isAndroidAppLaunch } from "@/lib/app-platform";

/** Login talab qiladigan yo'llar */
const PROTECTED_PREFIXES = [
  "/onboarding",
  "/applications",
  "/offers",
  "/messages",
  "/saved",
  "/notifications",
  "/profile",
  "/settings",
  "/employer",
  // /company/[slug] — ochiq (SEO); faqat boshqaruv sahifalari yopiq
  "/company/settings",
  "/company/join",
  "/workers",
  "/admin",
  "/billing",
];

export async function proxy(request: NextRequest) {
  // Til: ?lang=ru → shu so'rovning o'zi ham shu tilda chiziladi (Google ruscha sahifani ko'rishi uchun) + cookie
  const lang = request.nextUrl.searchParams.get("lang");
  if (lang && isLocale(lang)) request.cookies.set(LOCALE_COOKIE, lang);

  // Google Play ilovasi (TWA) ichida ochildi — keyingi sahifalar uchun eslab qolamiz (to'lov tugmalari yashiriladi)
  const androidLaunch = isAndroidAppLaunch(request.headers.get("referer"), request.nextUrl.searchParams.get("app"));
  if (androidLaunch) request.cookies.set(APP_COOKIE, ANDROID_APP);

  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (lang && isLocale(lang)) {
    response.cookies.set(LOCALE_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }

  if (androidLaunch) {
    response.cookies.set(APP_COOKIE, ANDROID_APP, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }

  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  if (pathname === "/auth" && user) {
    const next = request.nextUrl.searchParams.get("next");
    const url = request.nextUrl.clone();
    // faqat shu saytdagi manzil; so'rov qismi (?step=4) saqlanadi — kirgandan keyin aynan to'xtagan qadamga qaytiladi
    const safe = next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
    const [path, query] = safe.split("?");
    url.pathname = path || "/";
    url.search = query ? `?${query}` : "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    // Statik fayllar va rasm optimizatsiyasidan tashqari hamma yo'llar
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
