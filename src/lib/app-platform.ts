/**
 * Google Play'dagi Android ilova (TWA) ichida ochilganini bilish.
 * Ilova saytni birinchi ochganda Referer "android-app://<paket>" bo'ladi (yoki start URL'da ?app=android) —
 * proxy shu paytda cookie qo'yadi va keyingi sahifalar ham ilova ichida ekanini biladi.
 *
 * Nima uchun kerak: Google Play raqamli xizmatlarni ilova ichida faqat Google Play Billing orqali sotishga ruxsat beradi.
 * Shuning uchun ilovada Payme/Click tugmalari va narxlar ko'rsatilmaydi (sayt va Telegram'da hammasi ishlaydi).
 */
export const APP_COOKIE = "ib_app";
export const ANDROID_APP = "android";

export function isAndroidAppLaunch(
  referer: string | null,
  appParam: string | null,
): boolean {
  return appParam === ANDROID_APP || !!referer?.startsWith("android-app://");
}
