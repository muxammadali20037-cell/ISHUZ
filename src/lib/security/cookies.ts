/**
 * Cookie atributlari: sayt https orqali ishlasa (production) — Secure (faqat shifrlangan ulanishda yuboriladi).
 * Lokal http (ishlab chiqish, E2E) da Secure qo'yilmaydi. Client va serverda bir xil (NEXT_PUBLIC_APP_URL).
 */
export const SECURE_COOKIES = (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://");

/** Supabase auth cookie'lari uchun (httpOnly emas — brauzer SDK o'qiydi; himoya: Secure + SameSite=Lax + CSP) */
export const SUPABASE_COOKIE_OPTIONS = { sameSite: "lax" as const, secure: SECURE_COOKIES, path: "/" };

/** Oddiy sozlama cookie'lari (til, ilova turi) */
export function prefCookie(maxAgeSeconds: number) {
  return { path: "/", maxAge: maxAgeSeconds, sameSite: "lax" as const, secure: SECURE_COOKIES };
}

/** document.cookie uchun qo'shimcha atributlar */
export const DOCUMENT_COOKIE_ATTRS = `; path=/; samesite=lax${SECURE_COOKIES ? "; secure" : ""}`;
