/**
 * AI yordamchi suhbatining sof mantiqi (runtime importsiz — vitest bilan testlanadi):
 * aniqlashtirish takliflari, so'rovga so'z qo'shish, ovozli kiritish tili, suhbatni qurilmada vaqtincha saqlash.
 */

export type FinderMode = "jobs" | "workers";

/** Natijada qaysi shartlar allaqachon qo'llangan (takliflar takrorlanmasin) — aiFind qaytaradi */
export interface AppliedFilters {
  daily: boolean;
  noexp: boolean;
  exp: boolean;
  remote: boolean;
  shift: boolean;
}

export type RefineKey = keyof AppliedFilters;

/**
 * Aniqlashtirish: tugma bosilsa oxirgi so'rovga shu so'z qo'shiladi va qayta qidiriladi. So'zlar o'zbekcha — ularni
 * lug'at (search/understand) har qanday interfeys tilida tushunadi; ekranda esa tugmaning o'z tilidagi nomi ko'rinadi.
 */
export const REFINE_WORDS: Record<RefineKey, string> = {
  daily: "kunlik",
  noexp: "tajribasiz",
  exp: "tajribali",
  remote: "masofaviy",
  shift: "smenali",
};

/** Rejim bo'yicha takliflar tartibi: ish e'lonlari va ishchilar uchun har xil */
export function refineOptions(mode: FinderMode, applied: AppliedFilters | null | undefined): RefineKey[] {
  const order: RefineKey[] = mode === "jobs" ? ["daily", "noexp", "remote", "shift"] : ["exp", "remote"];
  return order.filter((k) => !applied?.[k]);
}

const MAX = 300;

/** Oxirgi so'rovga so'z qo'shadi (bo'lsa — qo'shmaydi), 300 belgidan oshmaydi */
export function refineQuery(base: string, word: string): string {
  const b = base.replace(/\s+/g, " ").trim();
  const w = word.trim();
  if (!w) return b.slice(0, MAX);
  const has = b
    .toLowerCase()
    .split(/[\s,.;:!?«»"()]+/)
    .includes(w.toLowerCase());
  if (has) return b.slice(0, MAX);
  const joined = b ? `${b} ${w}` : w;
  return joined.length <= MAX ? joined : `${b.slice(0, MAX - w.length - 1).trimEnd()} ${w}`;
}

/** Ovozli kiritish (Web Speech API) uchun til: o'zbek (lotin va kirill) — uz-UZ */
export function speechLang(locale: string): string {
  if (locale === "ru") return "ru-RU";
  if (locale === "en") return "en-US";
  return "uz-UZ";
}

// ---------------------------------------------------------------------------
// Suhbatni qurilmada saqlash (sessionStorage): e'lon ochilib, "Orqaga" bosilganda suhbat yo'qolmasin.
// Faqat shu tabda va 30 daqiqa; o'qish/yozish xatosi jim o'tkaziladi (maxfiy rejim, to'lgan xotira).
// ---------------------------------------------------------------------------

export const CHAT_TTL_MS = 30 * 60 * 1000;
export const CHAT_KEEP = 5;

export interface StoredChat<T> {
  at: number;
  turns: T[];
}

export function chatStorageKey(mode: FinderMode): string {
  return `ib_ai_chat_v1:${mode}`;
}

/** Saqlangan suhbat: muddati o'tgan yoki buzilgan bo'lsa — bo'sh */
export function parseStoredChat<T>(raw: string | null, now: number): T[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as StoredChat<T>;
    if (!data || typeof data.at !== "number" || !Array.isArray(data.turns)) return [];
    if (now - data.at > CHAT_TTL_MS || data.at > now + 60_000) return [];
    return data.turns.slice(-CHAT_KEEP);
  } catch {
    return [];
  }
}

export function serializeChat<T>(turns: T[], now: number): string {
  return JSON.stringify({ at: now, turns: turns.slice(-CHAT_KEEP) } satisfies StoredChat<T>);
}
