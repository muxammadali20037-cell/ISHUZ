/**
 * Respublika ahamiyatidagi shahar (viloyat darajasidagi hudud, lekin shahar): "Butun viloyat" emas, "Butun shahar".
 * Qidiruv natijalarida faqat nom keladi (slug yo'q) — shuning uchun ma'lumotnoma nomi ham tekshiriladi (o'zgarmas seed).
 */
export const CITY_REGION_SLUGS = new Set(["tashkent_city"]);
const CITY_REGION_NAMES_UZ = new Set(["Toshkent shahri"]);

export function isCityRegion(r: { slug?: string | null; name_uz?: string | null } | null | undefined): boolean {
  if (!r) return false;
  return (!!r.slug && CITY_REGION_SLUGS.has(r.slug)) || (!!r.name_uz && CITY_REGION_NAMES_UZ.has(r.name_uz));
}
