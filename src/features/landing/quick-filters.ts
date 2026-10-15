import { EMPTY_FIND, findHref, type FindParams } from "@/features/find/params";

/** Bosh sahifadagi tez filtrlar: maosh chegarasi (oylik ekvivalent, so'm) */
export const QUICK_SALARY = 5_000_000;

export type QuickFilterKey = "salary" | "noexp" | "daily" | "remote";

export interface QuickFilter {
  key: QuickFilterKey;
  href: string;
}

/**
 * Ish qidiruvchi tez filtrlari — bir bosishda natijalar (kasb so'ralmaydi): eslab qolingan hududda, bo'lmasa butun O'zbekiston.
 * "Masofaviy" — hududdan qat'i nazar. Hammasi /search URL holati (orqaga tugmasi, ulashish ishlaydi).
 */
export function seekerQuickFilters(place: { region: string | null; district: string | null }): QuickFilter[] {
  const where: Partial<FindParams> = { region: place.region ?? "all", district: place.region ? (place.district ?? "all") : null };
  const any: FindParams = { ...EMPTY_FIND, mode: "jobs", any: true, ...where };
  return [
    { key: "salary", href: findHref(any, { salary: QUICK_SALARY }) },
    { key: "noexp", href: findHref(any, { noexp: true }) },
    { key: "daily", href: findHref({ ...EMPTY_FIND, mode: "jobs", pay: "daily", ...where }) },
    { key: "remote", href: findHref(any, { region: "remote", district: null }) },
  ];
}

/** Ish beruvchi tez filtrlari: tajribali ishchilar (hududda) va yaqin atrofdagilar (joylashuv yoki eslab qolingan tuman) */
export function employerQuickFilters(place: { region: string | null; district: string | null }): { key: "experienced" | "near"; href: string }[] {
  const any: FindParams = { ...EMPTY_FIND, mode: "workers", any: true, region: place.region ?? "all", district: place.region ? (place.district ?? "all") : null };
  return [
    { key: "experienced", href: findHref(any, { exp: true }) },
    { key: "near", href: findHref({ ...EMPTY_FIND, mode: "workers", near: true }) },
  ];
}

/** Hududni tanlash/o'zgartirish: kasb so'ralmaydi — "Joylashuvim bo'yicha", eslab qolingan hudud va ro'yxat */
export function placeChooserHref(scope: "jobs" | "workers"): string {
  return findHref({ ...EMPTY_FIND, mode: scope, any: true });
}
