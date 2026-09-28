/**
 * Telegram bot ichida CV to'ldirish: savollar tartibi va javoblarni tekshirish.
 * Sof modul (I/O yo'q) — vitest bilan testlanadi. Har bir savol — alohida xabar, iloji bo'lsa tugma bilan.
 */

export type CvStep =
  | "name"
  | "birth"
  | "gender"
  | "category"
  | "subcategory"
  | "region"
  | "district"
  | "experience"
  | "prev_job"
  | "skills"
  | "russian"
  | "english"
  | "salary"
  | "employment"
  | "availability"
  | "about"
  | "phone";

export const EXPERIENCE_LEVELS = ["none", "lt_6m", "6_12m", "1_2y", "2_3y", "3_5y", "5y_plus"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];
export const LANGUAGE_CHOICES = ["no", "a2", "b1", "b2", "c1"] as const;
export type LanguageChoice = (typeof LANGUAGE_CHOICES)[number];
export const EMPLOYMENT_CHOICES = ["full_time", "part_time", "shift", "temporary", "remote"] as const;
export type EmploymentChoice = (typeof EMPLOYMENT_CHOICES)[number];
export const AVAILABILITY_CHOICES = ["today", "tomorrow", "within_week", "negotiable"] as const;
export type AvailabilityChoice = (typeof AVAILABILITY_CHOICES)[number];
export const SALARY_PRESETS = [2_000_000, 3_000_000, 4_000_000, 5_000_000, 7_000_000, 10_000_000, 15_000_000] as const;

/** Ingliz tili faqat shu sohalarda so'raladi (boshqalarda ortiqcha savol) */
const ENGLISH_CATEGORIES = new Set(["it", "marketing", "design", "office", "finance", "education", "medicine"]);

export interface CvDraft {
  first_name?: string;
  last_name?: string;
  birth_date?: string;
  gender?: "male" | "female";
  category_id?: string;
  category_slug?: string;
  subcategory_id?: string | null;
  region_id?: string;
  district_id?: string | null;
  experience?: ExperienceLevel;
  prev_job?: string | null;
  skills: string[];
  russian?: LanguageChoice;
  english?: LanguageChoice;
  salary?: number | null;
  employment: EmploymentChoice[];
  availability?: AvailabilityChoice;
  about?: string | null;
  /** Orqaga qaytish uchun o'tilgan savollar */
  history: CvStep[];
}

export function emptyDraft(): CvDraft {
  return { skills: [], employment: [], history: [] };
}

export interface FlowContext {
  /** Telefon allaqachon ulangan (so'ralmaydi) */
  hasPhone: boolean;
  /** Kasbga mos ko'nikma variantlari bor */
  hasSkillOptions: boolean;
  /** Tanlangan viloyatda tumanlar bor */
  hasDistricts: boolean;
  /** Tanlangan sohada kasblar bor */
  hasSubcategories: boolean;
}

const ORDER: CvStep[] = [
  "name",
  "birth",
  "gender",
  "category",
  "subcategory",
  "region",
  "district",
  "experience",
  "prev_job",
  "skills",
  "russian",
  "english",
  "salary",
  "employment",
  "availability",
  "about",
  "phone",
];

/** Keraksiz savollar tashlab o'tiladi (tajribasi yo'qqa oldingi ish so'ralmaydi va h.k.) */
export function isRelevant(step: CvStep, d: CvDraft, ctx: FlowContext): boolean {
  switch (step) {
    case "subcategory":
      return ctx.hasSubcategories;
    case "district":
      return ctx.hasDistricts;
    case "prev_job":
      return !!d.experience && d.experience !== "none";
    case "skills":
      return ctx.hasSkillOptions;
    case "english":
      return !!d.category_slug && ENGLISH_CATEGORIES.has(d.category_slug);
    case "phone":
      return !ctx.hasPhone;
    default:
      return true;
  }
}

/** Keyingi savol; hammasi tugagan bo'lsa null */
export function nextStep(current: CvStep | null, d: CvDraft, ctx: FlowContext): CvStep | null {
  const start = current ? ORDER.indexOf(current) + 1 : 0;
  for (let i = start; i < ORDER.length; i++) {
    const s = ORDER[i]!;
    if (isRelevant(s, d, ctx)) return s;
  }
  return null;
}

/** Savol raqami va jami (progress: "3/12") */
export function progress(step: CvStep, d: CvDraft, ctx: FlowContext): { index: number; total: number } {
  const relevant = ORDER.filter((s) => isRelevant(s, d, ctx));
  return { index: Math.max(1, relevant.indexOf(step) + 1), total: relevant.length };
}

// ---------------------------------------------------------------------------
// Matnli javoblarni tekshirish
// ---------------------------------------------------------------------------

const NAME_PART = /^[\p{L}][\p{L}'’ʻʼ`-]{1,39}$/u;

/** "Aziza Karimova" → {first, last}. Bitta so'z yoki raqam — null */
export function parseFullName(text: string): { first_name: string; last_name: string } | null {
  const parts = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (parts.length < 2 || parts.length > 4) return null;
  if (!parts.every((p) => NAME_PART.test(p))) return null;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return { first_name: cap(parts[0]!), last_name: parts.slice(1).map(cap).join(" ") };
}

/** "15.03.1998", "15/03/1998", "1998-03-15" → "1998-03-15"; yosh 14–80 bo'lishi kerak */
export function parseBirthDate(text: string, now: Date = new Date()): string | null {
  const s = text.trim();
  let y: number, m: number, day: number;
  const dmy = /^(\d{1,2})[./\-\s](\d{1,2})[./\-\s](\d{4})$/.exec(s);
  const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (dmy) [day, m, y] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
  else if (ymd) [y, m, day] = [Number(ymd[1]), Number(ymd[2]), Number(ymd[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, day));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== day) return null;
  let age = now.getUTCFullYear() - y;
  if (now.getUTCMonth() < m - 1 || (now.getUTCMonth() === m - 1 && now.getUTCDate() < day)) age--;
  if (age < 14 || age > 80) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "5 mln", "5000000", "5 000 000", "4.5 млн", "800 ming" → so'm; noma'lum — null */
export function parseSalary(text: string): number | null {
  const s = text.toLowerCase().replace(/[’‘ʻʼ`]/g, "'").replace(/(\d)[\s_](?=\d{3}\b)/g, "$1").replace(",", ".").trim();
  const m = /(\d+(?:\.\d+)?)\s*(mln|million|млн|ming|тыс|m|k)?/.exec(s);
  if (!m) return null;
  let n = Number.parseFloat(m[1]!);
  const unit = m[2] ?? "";
  if (["mln", "million", "млн", "m"].includes(unit)) n *= 1_000_000;
  else if (["ming", "тыс", "k"].includes(unit)) n *= 1_000;
  n = Math.round(n);
  if (n < 100_000 || n > 500_000_000) return null;
  return n;
}

/** Erkin matn: bo'sh joylar tozalanadi, uzunlik cheklanadi */
export function cleanText(text: string, max: number): string | null {
  const s = text.replace(/\s+/g, " ").trim();
  return s.length >= 2 ? s.slice(0, max) : null;
}

/** Ko'p tanlovli ro'yxatda qiymatni yoqish/o'chirish */
export function toggle<T>(list: readonly T[], value: T, max = 30): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value].slice(0, max);
}

/** Tajriba darajasi → CV'dagi "o'zi haqida" uchun qisqa matn (oldingi ish joyi bilan) */
export function aboutText(d: CvDraft, words: { prevJob: (job: string) => string }): string | null {
  const parts = [d.about?.trim() || null, d.prev_job ? words.prevJob(d.prev_job) : null].filter((x): x is string => !!x);
  return parts.length ? parts.join("\n") : null;
}
