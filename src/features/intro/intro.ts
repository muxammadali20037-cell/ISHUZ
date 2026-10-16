/** Tanishtiruv ko'rilgan (bir marta): brauzer yozadi, server o'qiydi */
export const INTRO_COOKIE = "ib_intro";

/** Qidiruv robotlari va havola ko'rib chiquvchilar — tanishtiruv ko'rsatilmaydi (sahifa mazmuni darhol ko'rinsin) */
const BOT_UA = /bot|crawl|spider|slurp|lighthouse|facebookexternalhit|preview|embedly|whatsapp|vkshare/i;

/**
 * Tanishtiruv kerakmi: rejim hali tanlanmagan, avval ko'rilmagan, robot emas.
 * Kirgan, lekin rejimi yo'q yangi foydalanuvchiga ham ko'rsatiladi (masalan, Telegram'dan birinchi kirish).
 */
export function introEligible(input: { mode: string | null; cookie: string | undefined; userAgent: string | null }): boolean {
  return input.mode === null && !input.cookie && !BOT_UA.test(input.userAgent ?? "");
}
