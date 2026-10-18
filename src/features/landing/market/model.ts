import { EMPTY_FIND, findHref, type FindParams } from "@/features/find/params";
import { SALARY_PRESETS } from "@/features/jobs/search-params";
import type { Enums } from "@/types/database.types";

/**
 * Bosh sahifa (mehmon, rejim tanlanmagan) — sof qoidalar (unit test: model.test.ts): qidiruv paneli → /search URL,
 * "Yangi ishlar" filtrlari, bazadagi sonlar. Hammasi mavjud qidiruv URL holatiga tushadi (yangi qidiruv tizimi yo'q).
 */

/** Qidiruv panelidagi "Ish turi": kunlik to'lov yoki ish grafigi (/search: pay=daily | schedule=…) */
export const WORK_TYPES = ["daily", "5_2", "6_1", "2_2", "shift", "flexible"] as const;
export type WorkType = (typeof WORK_TYPES)[number];

/** Maosh (oylik ekvivalent, dan) — /jobs bilan bir xil qadamlar */
export const HERO_SALARIES = SALARY_PRESETS;

export interface HeroSearchInput {
  q: string;
  /** "" — tanlanmagan (matndan aniqlanadi yoki keyingi qadamda so'raladi), "all", "remote" yoki viloyat slug */
  region: string;
  type: string;
  salary: string;
}

/**
 * Panel → /search URL. Kasb yozilmagan bo'lsa — barcha kasblar (any=1); hudud tanlanmagan bo'lsa — matndan aniqlanadi
 * yoki /search o'zi so'raydi; viloyat tanlansa — /search keyingi qadamda tumanni so'raydi (mavjud oqim).
 * Noto'g'ri qiymatlar (boshqa slug, ro'yxatdan tashqari maosh) tashlab yuboriladi.
 */
export function heroSearchHref(input: HeroSearchInput, regionSlugs: readonly string[]): string {
  const q = input.q.replace(/\s+/g, " ").trim().slice(0, 120);
  const region = input.region === "all" || input.region === "remote" || regionSlugs.includes(input.region) ? input.region : null;
  const type = (WORK_TYPES as readonly string[]).includes(input.type) ? (input.type as WorkType) : null;
  const salary = Number.parseInt(input.salary, 10);
  const params: FindParams = {
    ...EMPTY_FIND,
    mode: "jobs",
    q: q.length >= 2 ? q : "",
    region,
    any: q.length < 2,
    pay: type === "daily" ? "daily" : null,
    schedule: type && type !== "daily" ? (type as Enums<"work_schedule">) : null,
    salary: (HERO_SALARIES as readonly number[]).includes(salary) ? salary : null,
  };
  return findHref(params);
}

/** "Yangi ishlar" filtrlari: hammasi mavjud qidiruv bajaradigan filtrlar ("Doimiy" — oddiy qidiruvda yo'q, shuning uchun yo'q) */
export const LATEST_TABS = ["all", "daily", "remote", "noexp"] as const;
export type LatestTab = (typeof LATEST_TABS)[number];

export function parseLatestTab(raw: string | string[] | undefined): LatestTab {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (LATEST_TABS as readonly string[]).includes(v ?? "") ? (v as LatestTab) : "all";
}

/** Filtr → qidiruv parametrlari (bosh sahifa ro'yxati va "Barcha ishlarni ko'rish" bir xil so'rov) */
export function latestTabFind(tab: LatestTab): { params: FindParams; remote: boolean } {
  const base: FindParams = { ...EMPTY_FIND, mode: "jobs", any: true, region: "all" };
  switch (tab) {
    case "daily":
      return { params: { ...base, any: false, pay: "daily" }, remote: false };
    case "remote":
      return { params: { ...base, region: "remote" }, remote: true };
    case "noexp":
      return { params: { ...base, noexp: true }, remote: false };
    default:
      return { params: base, remote: false };
  }
}

/** Bosh sahifadagi filtr havolasi: o'sha sahifa, ro'yxat bo'limiga */
export function latestTabHref(tab: LatestTab): string {
  return tab === "all" ? "/#yangi-ishlar" : `/?ish=${tab}#yangi-ishlar`;
}

export interface MarketCounts {
  /** categories.id → faol vakansiyalar soni */
  categories: Record<string, number>;
  /** kamida bitta faol vakansiyasi bor ish beruvchilar */
  employers: number;
}

/** home_market_counts() javobi (jsonb) → tekshirilgan sonlar; shakli boshqacha bo'lsa — null (son ko'rsatilmaydi) */
export function parseMarketCounts(json: unknown): MarketCounts | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const { categories, employers } = json as { categories?: unknown; employers?: unknown };
  if (!categories || typeof categories !== "object" || Array.isArray(categories)) return null;
  const emp = Number(employers);
  if (!Number.isInteger(emp) || emp < 0) return null;
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(categories as Record<string, unknown>)) {
    const n = Number(v);
    if (/^[0-9a-f-]{36}$/i.test(id) && Number.isInteger(n) && n > 0) out[id] = n;
  }
  return { categories: out, employers: emp };
}

/** Bosh sahifada birinchi ko'rinadigan sohalar soni (qolgani — "Barcha kategoriyalar" ichida) */
export const CATEGORY_PREVIEW = 12;
