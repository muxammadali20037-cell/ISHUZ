import type { JobCardData } from "./components/result-cards";
import type { WorkerRow } from "./queries";

/**
 * Yordamchi — oddiy qidiruv (ega, 2026-11-16: "AI uzun matn yozmasin; so'rov qilgandan keyin oyna chiqsin — qaysi hudud,
 * oylik maosh qancha — keyin «Qidirish»; ish yo'q bo'lsa «so'rovingiz saqlandi, xabar beramiz»; yaqin kasblar pastda").
 * Bu fayl mijoz va server uchun umumiy turlar (runtime importsiz).
 */

export type QuickMode = "jobs" | "workers";

/** Hudud tanlovi: "all" — butun O'zbekiston, "remote" — masofaviy, "<viloyat slug>" yoki "<viloyat slug>~<tuman id>" */
export type QuickPlace = string;

/** Oylik maosh tanlovlari (so'm, "...dan"); null — farqi yo'q */
export const QUICK_SALARIES = [2_000_000, 4_000_000, 6_000_000, 10_000_000] as const;

export type QuickSchedule = "5_2" | "6_1" | "2_2" | "shift" | "flexible";

/** Matndan tushunilgan qo'shimcha shartlar ("kunlik", "tajribasiz", "smenali", "tajribali") — oynada olib tashlasa bo'ladi */
export interface QuickFilters {
  pay: "daily" | null;
  noexp: boolean;
  exp: boolean;
  schedule: QuickSchedule | null;
}

export const NO_FILTERS: QuickFilters = { pay: null, noexp: false, exp: false, schedule: null };

export interface QuickOption {
  value: string;
  label: string;
}

/** Oyna (so'rovnoma) — yozilgan matndan oldindan to'ldirilgan javoblar */
export interface QuickForm {
  mode: QuickMode;
  /** foydalanuvchi yozgan matn */
  text: string;
  /** "Qanday ish?" — tushunilgan kasb nomi (bo'lmasa — matndagi kalit so'z yoki bo'sh) */
  profession: string;
  /** tushunilgan kasb (foydalanuvchi nomni o'zgartirmasa — shu bilan qidiriladi) */
  nodeId: string | null;
  place: QuickPlace;
  salary: number | null;
  filters: QuickFilters;
  /** hudud ro'yxati (birinchisi — "Butun O'zbekiston") */
  places: QuickOption[];
  /** boshqa mavzu ("salom", "kimsan") — oyna o'rniga shu qisqa javob */
  reply?: string;
}

export interface QuickAnswers {
  profession: string;
  nodeId: string | null;
  place: QuickPlace;
  /** faqat ish qidirishda */
  salary: number | null;
  filters: QuickFilters;
}

export interface QuickList {
  jobs: JobCardData[];
  workers: WorkerRow[];
  images: Record<string, string>;
  photos: Record<string, string>;
  total: number;
  /** to'liq natijalar sahifasi */
  href: string;
}

/**
 * Hech narsa topilmaganda: "saved" — qidiruv saqlandi (mos ish chiqsa xabar keladi), "exists" — avval saqlangan,
 * "login" — mehmon (xabar uchun kirish kerak), "unclear" — nimani kuzatishni bilmaymiz (kasb ham, so'z ham yo'q),
 * "failed" — saqlab bo'lmadi (limit yoki texnik xato) — "xabar beramiz" deyilmaydi. Natija bor bo'lsa — null.
 */
export type QuickSaveState = "saved" | "exists" | "login" | "unclear" | "failed" | null;

export interface QuickResult extends QuickList {
  mode: QuickMode;
  /** ekranda: "Avtoinstruktor · Toshkent shahri · 4 mln so'mdan" */
  summary: string[];
  saved: string[];
  save: QuickSaveState;
  /** aynan so'ralgani yo'q — shunga yaqin kasblar (yoki shu kasb boshqa hududlarda) */
  similar: (QuickList & { kind: "near" | "elsewhere"; saved: string[] }) | null;
}
