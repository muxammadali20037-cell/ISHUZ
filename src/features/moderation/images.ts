/**
 * Telegram'ning avtomatik avatari: rasmi yo'q foydalanuvchiga Telegram ism harflaridan SVG yasaydi
 * (https://t.me/i/userpic/320/<hash>.svg). Bu foydalanuvchi yuklagan rasm emas — tekshiradigan narsa yo'q,
 * AI esa SVG ni qabul qilmaydi (moderatsiya "image_type" bilan tiqilib qolardi). Sof funksiya — testlanadi.
 */
export function isTelegramGeneratedAvatar(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && u.hostname === "t.me" && u.pathname.startsWith("/i/userpic/") && u.pathname.toLowerCase().endsWith(".svg");
  } catch {
    return false;
  }
}
