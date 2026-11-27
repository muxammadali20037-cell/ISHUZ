/**
 * Texnik ishlar rejimi (4-bosqich: bazani Frankfurtga ko'chirish; docs/FRANKFURT_MIGRATION.md). Vercel'da
 * MAINTENANCE_MODE=1 qo'yilib qayta joylansa — sayt yozish so'rovlarini qabul qilmaydi: hamma sahifa va API 503
 * ("Texnik ishlar") qaytaradi, Retry-After bilan. Telegram webhook ham 503 oladi — Telegram yangilanishlarni keyin qayta
 * yuboradi (xabarlar yo'qolmaydi). Faqat /api/health ochiq (kuzatuv uchun). Sof modul — testlanadi.
 */
export function maintenanceOn(env: Record<string, string | undefined> = process.env): boolean {
  return env.MAINTENANCE_MODE === "1" || env.MAINTENANCE_MODE === "true";
}

/** texnik ishlar paytida ham ochiq yo'llar */
export function maintenanceOpen(pathname: string): boolean {
  return pathname === "/api/health";
}

/** taxminiy davom etishi (Retry-After, soniya) */
export const MAINTENANCE_RETRY_SECONDS = 1800;

/** API so'rovlari uchun — JSON; sahifalar uchun — oddiy HTML (uch tilda; tashqi resurs va rang kodi yo'q) */
export function maintenanceBody(pathname: string): { body: string; contentType: string } {
  if (pathname.startsWith("/api/")) {
    return { body: JSON.stringify({ ok: false, error: "maintenance" }), contentType: "application/json; charset=utf-8" };
  }
  const body = `<!doctype html>
<html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Texnik ishlar · Ish topdim</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:Canvas;color:CanvasText}main{max-width:28rem;padding:2rem 1.5rem;text-align:center;line-height:1.5}h1{font-size:1.5rem;margin:0 0 .5rem}p{margin:.25rem 0;color:GrayText}</style>
</head><body><main data-maintenance>
<h1>Texnik ishlar olib borilmoqda</h1>
<p>Sayt tez orada yana ishlaydi. Ma'lumotlaringiz saqlanadi.</p>
<p lang="ru">Идут технические работы. Сайт скоро снова заработает.</p>
<p lang="en">Scheduled maintenance. We'll be back shortly.</p>
</main></body></html>`;
  return { body, contentType: "text/html; charset=utf-8" };
}
