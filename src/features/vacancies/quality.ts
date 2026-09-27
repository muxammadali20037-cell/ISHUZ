/**
 * Vakansiya sifati (e'lon qilishdan oldin): AI'siz, deterministik tekshiruvlar.
 * Foydalanuvchiga texnik ogohlantirish emas — qisqa, amaliy maslahat ("Maoshni ko'rsatsangiz ...").
 * Sof modul — vitest bilan testlanadi. Bloklamaydi: e'lon qilish qarori ish beruvchida.
 */
import type { StepKey } from "./steps";

export type QualityLevel = "good" | "ok" | "weak";
export type TipSeverity = "risk" | "improve";

export interface QualityTip {
  /** i18n: vacancies.quality.tips.<key> */
  key: "scam_words" | "contact_in_text" | "salary_missing" | "salary_suspicious" | "description_short" | "caps_title" | "shouting" | "no_skills" | "no_address" | "no_work_time" | "wide_age";
  severity: TipSeverity;
  step: StepKey;
}

export interface QualityInput {
  title: string;
  description: string | null;
  salary_from: number | null;
  salary_to: number | null;
  salary_type: "monthly" | "daily" | "hourly" | "piecework" | "negotiable";
  salary_negotiable: boolean;
  is_remote: boolean;
  address: string | null;
  district_id: string | null;
  work_time_from: string | null;
  work_time_to: string | null;
  age_min: number | null;
  age_max: number | null;
  skills: readonly unknown[];
}

// Oldindan pul so'rash — firibgarlikning eng keng tarqalgan belgisi (uz lotin/kirill, ru)
const SCAM_RE =
  /(oldindan\s+to'?lov|oldindan\s+pul|depozit|zalog|garov\s+pul|o'qish\s+pullik|o'qish\s+uchun\s+to'?lov|forma\s+uchun\s+pul|предоплат|залог|депозит|платное\s+обучение|оплатите\s+обучение|вступительный\s+взнос|олдиндан\s+тўлов)/i;
const PHONE_RE = /(\+?998[\s\-()]*\d{2}[\s\-()]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2})|(\b\d{2}[\s\-]\d{3}[\s\-]\d{2}[\s\-]\d{2}\b)/;
const LINK_RE = /(https?:\/\/|www\.|t\.me\/|@[a-z0-9_]{5,})/i;

/** Oylik ekvivalent bo'yicha odatiy oraliq (so'm). Undan tashqari — "tekshirib ko'ring" */
const SANE: Record<string, [number, number]> = {
  monthly: [500_000, 150_000_000],
  daily: [30_000, 5_000_000],
  hourly: [5_000, 1_000_000],
  piecework: [1_000, 50_000_000],
};

function upperRatio(s: string): number {
  const letters = s.replace(/[^a-zA-Zа-яА-ЯёЁўЎқҚғҒҳҲ]/g, "");
  if (letters.length < 6) return 0;
  const upper = letters.replace(/[^A-ZА-ЯЁЎҚҒҲ]/g, "").length;
  return upper / letters.length;
}

export function assessVacancy(v: QualityInput): { score: number; level: QualityLevel; tips: QualityTip[] } {
  const tips: QualityTip[] = [];
  const text = `${v.title}\n${v.description ?? ""}`;
  const desc = (v.description ?? "").trim();

  if (SCAM_RE.test(text)) tips.push({ key: "scam_words", severity: "risk", step: "description" });
  if (PHONE_RE.test(text) || LINK_RE.test(text)) tips.push({ key: "contact_in_text", severity: "risk", step: "description" });

  const amount = v.salary_to ?? v.salary_from;
  if (!v.salary_negotiable && v.salary_type !== "negotiable" && amount === null) tips.push({ key: "salary_missing", severity: "improve", step: "salary" });
  if (amount !== null && !v.salary_negotiable) {
    const range = SANE[v.salary_type];
    const low = v.salary_from ?? amount;
    if (range && (low < range[0] || amount > range[1])) tips.push({ key: "salary_suspicious", severity: "risk", step: "salary" });
  }

  if (desc.length < 80) tips.push({ key: "description_short", severity: "improve", step: "description" });
  if (upperRatio(v.title) > 0.7) tips.push({ key: "caps_title", severity: "improve", step: "title" });
  if (/!{3,}|\?{3,}/.test(text) || upperRatio(desc) > 0.6) tips.push({ key: "shouting", severity: "improve", step: "description" });
  if (!v.skills.length) tips.push({ key: "no_skills", severity: "improve", step: "skills" });
  if (!v.is_remote && !v.address?.trim() && !v.district_id) tips.push({ key: "no_address", severity: "improve", step: "location" });
  if (!v.work_time_from || !v.work_time_to) tips.push({ key: "no_work_time", severity: "improve", step: "schedule" });
  if (v.age_min !== null && v.age_max !== null && v.age_max - v.age_min < 5) tips.push({ key: "wide_age", severity: "improve", step: "requirements" });

  const weight: Record<QualityTip["key"], number> = {
    scam_words: 45,
    contact_in_text: 20,
    salary_suspicious: 20,
    salary_missing: 15,
    description_short: 15,
    caps_title: 8,
    shouting: 8,
    no_skills: 8,
    no_address: 6,
    no_work_time: 5,
    wide_age: 5,
  };
  const score = Math.max(0, 100 - tips.reduce((s, t) => s + weight[t.key], 0));
  const level: QualityLevel = tips.some((t) => t.severity === "risk") || score < 60 ? "weak" : score < 85 ? "ok" : "good";
  // Xavfli belgilar birinchi
  tips.sort((a, b) => (a.severity === b.severity ? weight[b.key] - weight[a.key] : a.severity === "risk" ? -1 : 1));
  return { score, level, tips };
}
