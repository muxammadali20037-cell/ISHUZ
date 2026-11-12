import { stack, sql } from "./support";

/**
 * Har ishga tushirishdan oldin:
 * 1) sinov bazasidagi so'rov chegarasi hisoblagichlari tozalanadi. Cheklovlar (masalan, kuniga N ta vakansiya) haqiqiy
 *    va o'zgarmaydi; faqat bir stendda suite qayta-qayta yurganda oldingi yurishlarning hisobi keyingisiga
 *    "Juda ko'p urinish" bo'lib o'tmasligi uchun.
 * 2) server "isitiladi": bosh sahifalar va ulardagi barcha rasm variantlari (srcset) bir marta so'raladi. CI'da (2 yadro)
 *    birinchi testlar sovuq serverda rasm optimizatsiyasini kutib 2 daqiqalik chegaradan oshardi (2026-11: a11y "home",
 *    "home-worker" va layout-overlap "1440 uz" — mahalliy stendda 10 s ichida o'tadi). Bu testlarni yumshatmaydi:
 *    keyingi so'rovlar ham xuddi shu kodni ishlatadi, faqat birinchi marta sharp keshini to'ldirish testdan tashqarida.
 */
async function warmUp() {
  const deadline = Date.now() + 4 * 60_000;
  const get = (url: string) => fetch(url, { signal: AbortSignal.timeout(Math.max(1000, deadline - Date.now())) }).then((r) => r.text()).catch(() => "");
  const images = new Set<string>();
  for (const path of ["/", "/?mode=worker", "/?mode=employer", "/jobs", "/kasblar"]) {
    const html = await get(`${stack.app}${path}`);
    for (const m of html.matchAll(/\/_next\/image\?[^"'\s,]+/g)) images.add(m[0].replace(/&amp;/g, "&"));
  }
  const list = [...images];
  // bir vaqtda 4 tadan — sovuq serverni yanada bo'g'ib qo'ymaslik uchun
  for (let i = 0; i < list.length && Date.now() < deadline; i += 4) {
    await Promise.all(list.slice(i, i + 4).map((u) => get(`${stack.app}${u}`)));
  }
}

export default async function globalSetup() {
  await sql("delete from public.rate_limits");
  await warmUp();
}
