import { EMPTY_FIND, findHref, type FindParams } from "@/features/find/params";

/** Bosh sahifadagi tez filtrlar: maosh chegarasi (oylik ekvivalent, so'm) */
export const QUICK_SALARY = 5_000_000;

export type QuickFilterKey = "daily" | "noexp" | "remote" | "students";

export interface QuickFilter {
  key: QuickFilterKey;
  href: string;
}

/**
 * Ish qidiruvchi tez filtrlari (2026-10 redizayn: Kunlik · Tajribasiz · Masofaviy · Talabalar uchun) — bir bosishda natijalar
 * (kasb so'ralmaydi): eslab qolingan hududda, bo'lmasa butun O'zbekiston. "Masofaviy" — hududdan qat'i nazar. Qidiruvdagilar —
 * /search URL holati (orqaga tugmasi, ulashish ishlaydi). "Talabalar uchun" — talabalar bo'limi (/students: amaliyot, stajirovka,
 * darsdan keyin, talabalarga mos e'lonlar).
 */
export function seekerQuickFilters(place: { region: string | null; district: string | null }): QuickFilter[] {
  const where: Partial<FindParams> = { region: place.region ?? "all", district: place.region ? (place.district ?? "all") : null };
  const any: FindParams = { ...EMPTY_FIND, mode: "jobs", any: true, ...where };
  return [
    { key: "daily", href: findHref({ ...EMPTY_FIND, mode: "jobs", pay: "daily", ...where }) },
    { key: "noexp", href: findHref(any, { noexp: true }) },
    { key: "remote", href: findHref(any, { region: "remote", district: null }) },
    { key: "students", href: "/students" },
  ];
}

/** "Filtrlar": eslab qolingan hududdagi barcha e'lonlar — natijalar sahifasida maosh, grafik, tajriba va boshqa filtrlar */
export function seekerFiltersHref(place: { region: string | null; district: string | null }): string {
  return findHref({ ...EMPTY_FIND, mode: "jobs", any: true, region: place.region ?? "all", district: place.region ? (place.district ?? "all") : null });
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

/** Ish beruvchi xizmatlari (bosh ekran to'ri): nomzodlar, kunlik ishchilar, tajribalilar, yaqin atrofda, masofaviy, barcha kasblar */
export function employerServiceHrefs(place: { region: string | null; district: string | null }) {
  const any: FindParams = { ...EMPTY_FIND, mode: "workers", any: true, region: place.region ?? "all", district: place.region ? (place.district ?? "all") : null };
  return {
    candidates: findHref(any),
    daily: findHref(any, { pay: "daily" }),
    experienced: findHref(any, { exp: true }),
    near: findHref({ ...EMPTY_FIND, mode: "workers", near: true }),
    remote: findHref(any, { region: "remote", district: null }),
    all: findHref(EMPTY_FIND, { mode: "workers" }),
  };
}
