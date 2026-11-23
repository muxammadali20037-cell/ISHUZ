import type { AppMode } from "@/features/mode/mode";
import { NO_FILTERS, type QuickFilters, type QuickForm, type QuickMode, type QuickOption, type QuickResult } from "@/features/find/quick-types";
import type { FamilyCategory } from "@/features/find/families";
import { normalizeText } from "@/features/search/understand";
import type { PostChoiceGroup, PostOutcome, PostPreview } from "@/features/find/quick-post-types";
import type { PostAsk } from "./post-logic";

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
  /** hudud foydalanuvchining o'z gapida aytilgan (eslab qolingan yoki qatorda tanlangan emas) */
  placeSaid?: boolean;
  filters: QuickFilters;
  places: QuickOption[];
  /** prepareQuick qaysi rejimda tushungan (filtrlar shu rejimniki) */
  formMode: Role;
  /** kasb bir marta so'raldi — ikkinchi marta so'ralmaydi (tushunilmasa ham yozilgan so'z bilan qidiriladi) */
  askedProfession: boolean;
  /** kamida bitta savol berildi (rol, kasb yoki hudud) — oxirida "Endi nima qilamiz?" tanlovi (ega, 2026-11-22) */
  guided?: boolean;
  /** "Mavjud e'lonlarni ko'rish" tanlangan — keyingi qidiruvlarda (boshqa viloyat) tanlov qayta so'ralmaydi */
  see?: boolean;
  /** butun soha ("kuryer", "IT") — kasb so'ralmaydi, shu sohaning hamma vakansiyalari (families.ts) */
  category?: FamilyCategory | null;
  /** "Hamma ishlar" / "Hamma ishchilar" tanlandi (yoki "farqi yo'q" deb yozildi) — kasbsiz qidiruv */
  anyProfession?: boolean;
}

export type AiPart =
  | { kind: "thinking"; text?: string }
  | { kind: "searching"; mode: Role }
  | { kind: "reply"; text: string }
  | { kind: "ask"; ask: Ask; mode: Role | null; word?: string; profession?: string; options?: QuickOption[] }
  | { kind: "post"; who: "worker" | "employer" | null; query: string }
  /**
   * Chatda ishchi e'loni (3-bosqich): bittadan savol. `word` — tushunilmagan kasb; `retry` — javob tushunilmadi (qayta
   * so'ralmoqda); `question`/`groups` — "aynan qaysi biri?" variantlari; `options` — viloyat tugmalari
   */
  | { kind: "post-ask"; ask: PostAsk; intro?: boolean; word?: string; retry?: boolean; question?: string; groups?: PostChoiceGroup[]; options?: QuickOption[] }
  /** "E'loningiz shunday ko'rinadi" — "Joylash" tugmasi va rozilik yozuvi bilan */
  | { kind: "post-preview"; preview: PostPreview }
  /** joylash natijasi (haqiqiy holat) */
  | { kind: "post-done"; outcome: PostOutcome }
  /**
   * Kasb va hudud tayyor, savol-javob bilan kelindi — "Endi nima qilamiz?": ish izlovchi — mavjud e'lonlar yoki o'zi haqida
   * e'lon; ish beruvchi — mavjud ishchilar yoki vakansiya joylash (ega, 2026-11-22)
   */
  | { kind: "next"; mode: Role; draft: Draft; label: string }
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
export function nextAsk(
  d: Pick<Draft, "nodeId" | "profession" | "placeKnown" | "askedProfession"> & Partial<Pick<Draft, "filters" | "place" | "category" | "anyProfession">>,
  role: Role | null,
): Ask | null {
  if (!role) return "role";
  const prof = d.profession.trim();
  const skip = (!prof && broadAsk({ filters: d.filters ?? NO_FILTERS, place: d.place ?? "" })) || !!d.anyProfession || (role === "jobs" && !!d.category);
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
    placeSaid: !!form.placeSaid,
    filters: form.filters ?? NO_FILTERS,
    places: form.places,
    formMode: form.mode,
    askedProfession: false,
    category: form.category ?? null,
  };
}

/**
 * Bosh sahifadagi qidiruv qatorida tanlangan hudud — shu qurilmada eslab qolingan viloyatdan ustun (qatorda "Butun O'zbekiston"
 * tanlansa — butun O'zbekiston); matnda hudud aytilgan bo'lsa — o'shanisi qoladi. "Masofaviy" — faqat ish qidirishda (ishchi
 * qidirilsa — eslab qolingani yoki savol)
 */
export function withPlace(d: Draft, r: Role | null, place?: QuickOption): Draft {
  if (!place || d.placeSaid) return d;
  if (place.value === "remote" && r === "workers") return d;
  return { ...d, place: place.value, placeKnown: true };
}

/**
 * "Kasbingiz qanday?" savoliga javobda hudud ham aytilgan bo'lsa ("Toshkentda sotuvchi") — o'sha (oldin tanlangan yoki eslab
 * qolingandan ustun); aytilmagan bo'lsa — avvalgi hudud saqlanadi (yo'q bo'lsa — eslab qolingani)
 */
export function answerPlace(d: Pick<Draft, "place" | "placeKnown" | "placeSaid">, f: Pick<QuickForm, "place" | "placeKnown" | "placeSaid">): Pick<Draft, "place" | "placeKnown" | "placeSaid"> {
  if (f.placeSaid || (f.placeKnown && !d.placeKnown)) return { place: f.place, placeKnown: true, placeSaid: !!f.placeSaid };
  return { place: d.place, placeKnown: d.placeKnown, placeSaid: d.placeSaid };
}

/**
 * "Kasbingiz qanday?" savoliga "farqi yo'q", "hammasi", "любая" deb yozildi — kasbsiz qidiruv ("Hamma ishlar" tugmasi bilan bir xil).
 * Ega, 2026-11-22: "«ish kerak», «работа» deb yozsa ham natija topilsin".
 */
const ANY_PROFESSION = new Set(
  [
    "hammasi", "hamma", "hamma ishlar", "hamma ish", "hamma ishchilar", "barchasi", "barcha", "barcha ishlar", "farqi yoq", "farqi yo'q", "farq qilmaydi",
    "istalgan", "istalgan ish", "har qanday", "har qanday ish", "bari bir", "baribir", "nima bolsa ham", "nima bo'lsa ham", "boshqasi",
    "lyubaya", "lyuboy", "lyubaya rabota", "vse", "vsyo", "bez raznitsy", "bez raznitsi", "nevajno", "ne vajno", "any", "all", "anything", "whatever",
  ].map((w) => normalizeText(w)),
);

export function isAnyProfession(text: string): boolean {
  return ANY_PROFESSION.has(normalizeText(text).replace(/[.!?,]+$/g, "").trim());
}

/**
 * Hudud tanlovi: "Butun O'zbekiston", keyin viloyatlar (bazadagi tartibda: Toshkent shahri, Toshkent viloyati, …); masofaviy —
 * faqat ish qidirishda, oxirida. Chatda avval birinchi 3 tasi, qolgani "Hammasi" yoki qidiruv bilan (ega, 2026-11-22).
 */
export function placeChoices(places: QuickOption[], mode: Role): QuickOption[] {
  const regions = places.filter((p) => p.value !== "all" && p.value !== "remote" && !p.value.includes("~"));
  const all = places.find((p) => p.value === "all");
  const remote = mode === "jobs" ? places.find((p) => p.value === "remote") : undefined;
  return [...(all ? [all] : []), ...regions, ...(remote ? [remote] : [])];
}

/** Hamma narsa tayyor: savol-javob bilan kelingan bo'lsa — avval tanlov, aks holda (bitta to'liq gap) — darhol qidiruv */
export function readyStep(d: Pick<Draft, "guided" | "see">): "next" | "search" {
  return d.guided && !d.see ? "next" : "search";
}

/** Tanlovdan keyingi e'lon uchun hudud: viloyat tanlangan bo'lsa — o'sha (slug), "Butun O'zbekiston"/masofaviy — yo'q */
export function regionSlugOf(place: string): string | null {
  return place && place !== "all" && place !== "remote" ? (place.split("~")[0] ?? null) : null;
}

export function roleOfMode(mode: AppMode | null): Role | null {
  return mode === "employer" ? "workers" : mode === "worker" ? "jobs" : null;
}

