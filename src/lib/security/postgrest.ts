/**
 * PostgREST .or()/.filter() satriga foydalanuvchi matnini qo'yish: filtr sintaksisini buzadigan belgilar
 * (vergul, qavs, qo'shtirnoq, teskari chiziq) va LIKE shablon belgilari (% *) olib tashlanadi.
 * Natija faqat qiymat sifatida ishlatiladi; SQL parametrlangan (PostgREST) — bu sintaksis/shablon in'ektsiyasidan himoya.
 */
export function safeFilterValue(value: string): string {
  return value.replace(/[,()%*\\"]/g, " ").trim();
}
