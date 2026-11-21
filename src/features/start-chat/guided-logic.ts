import type { AppMode } from "@/features/mode/mode";
import { NO_FILTERS, type QuickFilters, type QuickForm, type QuickMode, type QuickOption, type QuickResult } from "@/features/find/quick-types";

/** Asosiy ekrandagi chat — sof qismlar (turlar va qaror qoidalari): mijoz komponenti va unit test uchun */

export type Role = QuickMode;
export type Ask = "role" | "profession" | "place";

/** Hozir qidirilayotgan narsa (savollarga javob bilan to'ladi) */
export interface Draft {
  text: string;
  profession: string;
  nodeId: string | null;
  place: string;
  placeKnown: boolean;
  filters: QuickFilters;
  places: QuickOption[];
  /** prepareQuick qaysi rejimda tushungan (filtrlar shu rejimniki) */
  formMode: Role;
  /** kasb bir marta so'raldi — ikkinchi marta so'ralmaydi (tushunilmasa ham yozilgan so'z bilan qidiriladi) */
  askedProfession: boolean;
}

export type AiPart =
  | { kind: "thinking" }
  | { kind: "searching"; mode: Role }
  | { kind: "reply"; text: string }
  | { kind: "ask"; ask: Ask; mode: Role | null; word?: string; profession?: string; options?: QuickOption[] }
  | { kind: "post"; who: "worker" | "employer" | null; query: string }
  | { kind: "results"; mode: Role; result: QuickResult; query: string; draft: Draft }
  | { kind: "error"; message: string };

export interface Msg {
  id: number;
  /** foydalanuvchi yozgani yoki tanlagani */
  you?: string;
  ai?: AiPart;
  /** savolga javob berildi — tugmalari endi ko'rinmaydi */
  answered?: boolean;
}

/**
 * Kasb aytilmagan, lekin turi aytilgan ("kunlik ish", "masofaviy ish", "tajriba talab qilinmaydigan ish") — odam istalgan
 * kasbdagi shunday ishni so'rayapti: kasb so'ralmaydi
 */
function broadAsk(d: Pick<Draft, "filters" | "place">): boolean {
  const f = d.filters ?? NO_FILTERS;
  return f.pay === "daily" || f.noexp || f.exp || f.schedule !== null || d.place === "remote";
}

/** Keyingi savol (yoki null — qidirishga tayyor). Sof funksiya — unit testda */
export function nextAsk(d: Pick<Draft, "nodeId" | "profession" | "placeKnown" | "askedProfession"> & Partial<Pick<Draft, "filters" | "place">>, role: Role | null): Ask | null {
  if (!role) return "role";
  const prof = d.profession.trim();
  const skip = !prof && broadAsk({ filters: d.filters ?? NO_FILTERS, place: d.place ?? "" });
  if (!d.nodeId && !skip && (!prof || !d.askedProfession)) return "profession";
  if (!d.placeKnown) return "place";
  return null;
}

/**
 * Tushunilmagan so'z — odam qanday yozgan bo'lsa shunday (katta-kichik harfi bilan): "Kosmonavt" → «Kosmonavt»
 * ("kosmonavt" emas). Matnda topilmasa — tushunilgan shakli.
 */
export function shownWord(word: string, text: string): string {
  const w = word.trim();
  const i = w ? text.toLowerCase().indexOf(w.toLowerCase()) : -1;
  return i >= 0 ? text.slice(i, i + w.length) : w;
}

export function draftFromForm(form: QuickForm): Draft {
  return {
    text: form.text,
    profession: form.profession,
    nodeId: form.nodeId,
    place: form.place,
    placeKnown: !!form.placeKnown,
    filters: form.filters ?? NO_FILTERS,
    places: form.places,
    formMode: form.mode,
    askedProfession: false,
  };
}

/** Hudud tugmalari: avval viloyatlar, keyin "Butun O'zbekiston"; masofaviy — faqat ish qidirishda */
export function placeChoices(places: QuickOption[], mode: Role): QuickOption[] {
  const regions = places.filter((p) => p.value !== "all" && p.value !== "remote" && !p.value.includes("~"));
  const all = places.find((p) => p.value === "all");
  const remote = mode === "jobs" ? places.find((p) => p.value === "remote") : undefined;
  return [...regions, ...(all ? [all] : []), ...(remote ? [remote] : [])];
}

export function roleOfMode(mode: AppMode | null): Role | null {
  return mode === "employer" ? "workers" : mode === "worker" ? "jobs" : null;
}

