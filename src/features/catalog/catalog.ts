/**
 * Kasblar katalogi (egasi, 2026-11-05: "haqiqiy suratli katalog"): bosh sahifa va /kasblar dagi suratli kartalar.
 * Har yozuv — ma'lumotnomadagi (categories) bitta soha; karta nomi egasi bergan ro'yxatdan (welcome.catalog.cat_<key>),
 * son va havola — o'sha sohaning haqiqiy vakansiyalari (/jobs?category=<slug>). Tartib — egasi bergan ro'yxat tartibi.
 *
 * Surat: admin yuklagani (Admin → Kontent → Kirish ekranlari → "Kasblar katalogi", app_settings.entry_media.cat_<key>) yoki
 * o'rnatilgan surat (src/assets/photos, faqat egasi bergan suratlar). Surati yo'q soha bosh sahifada "Boshqa kasblar"
 * kartasida nomi bilan chiqadi — bo'sh yoki belgili "soxta" karta yo'q.
 */
export const CATALOG = [
  { key: "construction", slug: "construction" },
  { key: "medicine", slug: "medicine" },
  { key: "education", slug: "education" },
  { key: "sales", slug: "sales" },
  { key: "transport", slug: "driver" },
  { key: "delivery", slug: "courier" },
  { key: "cooking", slug: "restaurant" },
  { key: "production", slug: "production" },
  { key: "it", slug: "it" },
  { key: "auto_service", slug: "auto_service" },
  { key: "agriculture", slug: "agriculture" },
  { key: "warehouse", slug: "logistics" },
  { key: "management", slug: "office" },
  { key: "services", slug: "cleaning" },
] as const;

export type CatalogKey = (typeof CATALOG)[number]["key"];
export type CatalogSlot = `cat_${CatalogKey}`;

export const CATALOG_SLOTS = CATALOG.map((c) => `cat_${c.key}` as CatalogSlot);

export function catalogSlot(key: CatalogKey): CatalogSlot {
  return `cat_${key}`;
}

/** Soha sahifasi (mavjud /jobs filtri) */
export function categoryHref(slug: string): string {
  return `/jobs?category=${encodeURIComponent(slug)}`;
}

/**
 * Bosh sahifa to'ri: N ta suratli karta + oxirida "Boshqa kasblar". Oxirgi karta qatorning bo'sh qolgan qismini to'ldiradi
 * (telefon 2, planshet 3, kompyuter 4 ustun) — to'r doim to'liq to'rtburchak. Tailwind uchun sinflar to'liq yozilgan.
 */
const SPAN = {
  base: ["", "col-span-1", "col-span-2"],
  md: ["", "md:col-span-1", "md:col-span-2", "md:col-span-3"],
  lg: ["", "lg:col-span-1", "lg:col-span-2", "lg:col-span-3", "lg:col-span-4"],
} as const;

export function tailSpan(count: number): { cls: string; wide: { base: boolean; md: boolean; lg: boolean } } {
  const span = (cols: number) => cols - (count % cols);
  const b = span(2);
  const m = span(3);
  const l = span(4);
  return { cls: [SPAN.base[b], SPAN.md[m], SPAN.lg[l]].join(" "), wide: { base: b > 1, md: m > 1, lg: l > 1 } };
}
