/**
 * Google orqali kirish (ega, 2026-11-26: "Google orqali kirishni ula"): Google bergan ma'lumotdan profilga faqat ism
 * olinadi. Google rasmi olinmaydi (foydalanuvchi o'zi qo'ymagan rasm e'lonlarida chiqib qolmasin), email esa profil
 * kontaktida yopiq turadi (handle_new_user — boshqalarga ko'rsatilmaydi).
 */

const clean = (s: unknown): string =>
  typeof s === "string"
    ? s
        .replace(/[\u0000-\u001f\u007f<>]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 60)
    : "";

/** Google metadata → ism va familiya (given_name/family_name bo'lsa — o'sha; yo'q bo'lsa — to'liq ismni bo'lib) */
export function namesFromGoogle(meta: Record<string, unknown> | null | undefined): { first: string; last: string } | null {
  if (!meta) return null;
  const given = clean(meta.given_name);
  if (given) return { first: given, last: clean(meta.family_name) };
  const full = clean(meta.full_name) || clean(meta.name);
  if (!full || full.includes("@")) return null;
  const [first, ...rest] = full.split(" ");
  return { first: first!, last: rest.join(" ").slice(0, 60) };
}

/** Tashqi (Google) rasm havolasi — bizning xotiradagi rasm emas */
export function isExternalAvatar(url: string | null | undefined): boolean {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

/**
 * Google orqali kirish tugmasi ko'rinadimi (brauzer tomoni): Google o'rnatilgan oynalarda (Telegram, Instagram, Facebook,
 * Android WebView) kirishni bloklaydi ("disallowed_useragent") — u yerda tugma chiqmaydi, Telegram/telefon qoladi.
 */
export function googleLoginAllowedIn(userAgent: string, telegramMiniApp: boolean): boolean {
  if (telegramMiniApp) return false;
  return !/Telegram|Instagram|FBAN|FBAV|FB_IAB|Line\/|; wv\)|WebView/i.test(userAgent);
}
