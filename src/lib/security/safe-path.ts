/**
 * Kirishdan keyin qaytish (?next=), kuzatiladigan havola va admin xabari havolasi uchun: faqat SHU saytdagi yo'l.
 * Brauzer URL'ni o'qiyotganda tab/yangi qatorni olib tashlaydi va "\" ni "/" deb oladi — "/\t/evil.uz" yoki
 * "/\evil.uz" kabi satrlar oddiy tekshiruvdan o'tib, boshqa saytga olib ketadi. Shuning uchun: boshqaruv belgilari
 * va teskari chiziq rad etiladi, so'ng URL sifatida o'qilib, kelib chiqishi (origin) tekshiriladi.
 */
const BASE = "https://internal.invalid";

export function safeInternalPath(input: string | null | undefined, fallback = "/"): string {
  if (typeof input !== "string" || input.length === 0 || input.length > 2000) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(input)) return fallback;
  if (!input.startsWith("/") || input.startsWith("//")) return fallback;
  let url: URL;
  try {
    url = new URL(input, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Satr o'zi xavfsiz ichki yo'lmi (masalan, admin kiritgan havola uchun zod refine) */
export function isSafeInternalPath(input: string): boolean {
  return safeInternalPath(input, "\u0000") === input;
}
