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
/** ekranda va xotirada turadigan savol-javoblar soni (suhbat konteksti uchun yetarli, xotira to'lmaydi) */
export const CHAT_KEEP = 8;

export interface StoredChat<T> {
  at: number;
  turns: T[];
}

export function chatStorageKey(mode: FinderMode): string {
  // v2 (2026-11): javob matni va tavsiya savollar qo'shildi — eski shakldagi suhbat o'qilmaydi
  return `ib_ai_chat_v2:${mode}`;
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

// ---------------------------------------------------------------------------
// So'nggi suhbatlar (localStorage): /ai sahifasidagi chap panel. Faqat shu qurilmada, serverga yuborilmaydi.
// Eng ko'pi CONVERSATIONS_KEEP ta, har biri CONVERSATION_TTL_MS gacha; sarlavha — birinchi savol.
// Xato (maxfiy rejim, to'lgan xotira, buzilgan yozuv) jim o'tkaziladi — suhbat shunchaki ro'yxatda ko'rinmaydi.
// ---------------------------------------------------------------------------

export const CONVERSATIONS_KEEP = 10;
export const CONVERSATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TITLE_MAX = 60;

export interface StoredConversation<T> {
  id: number;
  title: string;
  /** oxirgi yangilanish vaqti */
  at: number;
  turns: T[];
}

export function conversationsStorageKey(mode: FinderMode): string {
  return `ib_ai_convs_v1:${mode}`;
}

/** Ro'yxat sarlavhasi: birinchi savol, bir qatorda, 60 belgigacha */
export function conversationTitle(firstQuery: string): string {
  const s = firstQuery.replace(/\s+/g, " ").trim();
  if (s.length <= TITLE_MAX) return s;
  const cut = s.slice(0, TITLE_MAX);
  const space = cut.lastIndexOf(" ");
  return `${space > 24 ? cut.slice(0, space) : cut}…`;
}

export function parseStoredConversations<T>(raw: string | null, now: number): StoredConversation<T>[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (c): c is StoredConversation<T> =>
          !!c && typeof c === "object" && typeof (c as StoredConversation<T>).id === "number" && typeof (c as StoredConversation<T>).at === "number" && Array.isArray((c as StoredConversation<T>).turns),
      )
      .filter((c) => now - c.at <= CONVERSATION_TTL_MS && c.at <= now + 60_000 && c.turns.length > 0)
      .map((c) => ({ ...c, title: typeof c.title === "string" ? c.title : "", turns: c.turns.slice(-CHAT_KEEP) }))
      .sort((a, b) => b.at - a.at)
      .slice(0, CONVERSATIONS_KEEP);
  } catch {
    return [];
  }
}

/** Suhbatni ro'yxatga yozadi (bor bo'lsa — yangilaydi), eng yangisi birinchi; chegaradan ortig'i tushib qoladi */
export function upsertConversation<T>(list: StoredConversation<T>[], conv: StoredConversation<T>): StoredConversation<T>[] {
  if (!conv.turns.length) return list.filter((c) => c.id !== conv.id);
  const rest = list.filter((c) => c.id !== conv.id);
  return [{ ...conv, turns: conv.turns.slice(-CHAT_KEEP) }, ...rest].sort((a, b) => b.at - a.at).slice(0, CONVERSATIONS_KEEP);
}

export function serializeConversations<T>(list: StoredConversation<T>[]): string {
  return JSON.stringify(list.slice(0, CONVERSATIONS_KEEP));
}
