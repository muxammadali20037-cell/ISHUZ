import "server-only";

import type { StaticImageData } from "next/image";
import { getT } from "@/lib/i18n/server";
import { getCategories } from "@/lib/reference";
import { entryMediaUrl, type EntryMedia } from "@/features/entry/media";
import type { MarketCounts } from "@/features/landing/market/model";
import { CATALOG, catalogSlot, type CatalogKey } from "./catalog";
import { BUILTIN_CATALOG_PHOTOS } from "./photos";

export interface CatalogItem {
  key: CatalogKey;
  slug: string;
  label: string;
  /** faol vakansiyalar (bazadan); null — son noma'lum (ko'rsatilmaydi) */
  count: number | null;
  photo: { kind: "static"; src: StaticImageData } | { kind: "url"; src: string } | null;
  alt: string;
}

/**
 * Katalog yozuvlari egasi bergan tartibda. Ma'lumotnomada yo'q (yoki o'chirilgan) soha — tashlab yuboriladi (o'lik havola yo'q).
 * Surat: admin yuklagani ustun, keyin o'rnatilgani; ikkalasi ham yo'q — `photo: null`.
 */
export async function getCatalogItems(media: EntryMedia, counts: MarketCounts | null): Promise<CatalogItem[]> {
  const [{ t }, categories] = await Promise.all([getT(), getCategories()]);
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  return CATALOG.flatMap((entry) => {
    const cat = bySlug.get(entry.slug);
    if (!cat) return [];
    const uploaded = entryMediaUrl(media[catalogSlot(entry.key)]);
    const builtin = BUILTIN_CATALOG_PHOTOS[entry.key];
    const label = t(`welcome.catalog.cat_${entry.key}`);
    return [
      {
        key: entry.key,
        slug: entry.slug,
        label,
        count: counts ? (counts.categories[cat.id] ?? 0) : null,
        photo: uploaded ? { kind: "url" as const, src: uploaded } : builtin ? { kind: "static" as const, src: builtin } : null,
        // o'rnatilgan suratlarda — aniq tavsif; admin yuklaganida — soha nomi bilan umumiy tavsif
        alt: builtin && !uploaded ? t(`welcome.catalog.alt_${entry.key}`) : t("welcome.catalog.alt_generic", { name: label }),
      },
    ];
  });
}
