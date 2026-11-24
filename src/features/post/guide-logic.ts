import { normalizePhone } from "@/lib/format";
import { parseMoney } from "./money";
import { hoursRelevant, scheduleRelevant, type ExtraKey } from "./requirements";
import type { VacancyDraft } from "./types";

/**
 * "AI bilan oson joylash" (ish beruvchi, 2026-11-16, ega: "menga shunaqa kerak desa — ekranda savol chiqsin, tanlab-tanlab
 * o'tkazsin, yozuvlar kam bo'lsin"). Bir gapdan tushunilmagan narsalar ekranda BITTADAN so'raladi — tayyor variantlar bilan.
 * Qaysi savol navbatda ekanini shu sof funksiyalar hal qiladi (komponent ham, testlar ham shundan foydalanadi).
 */
export const GUIDE_STEPS = [
  "profession",
  // kasbga xos (ega, 2026-11-24): faqat shu kasbda so'raladi — haydovchi, kuryer, IT/dizayn, usta/quruvchi, tikuvchi
  "x_license",
  "x_car",
  "x_transport",
  "x_format",
  "x_term",
  "x_pay",
  "region",
  "district",
  "salary",
  "schedule",
  // ish vaqti — faqat kerak joyda; jinsi va yoshi — har kasbda (ega, 2026-11-24)
  "hours",
  "gender",
  "age",
  "experience",
  "employerType",
  "orgName",
  "phone",
  "notes",
  "description",
] as const;
export type GuideStep = (typeof GUIDE_STEPS)[number];

/** Savol berildi va javob olindi (ixtiyoriy savollar uchun: "farqi yo'q" ham javob) */
export type GuideAsked = ReadonlySet<GuideStep>;

type View = Pick<VacancyDraft, "profession" | "custom" | "place" | "salaryFrom" | "salaryTo" | "negotiable" | "schedule" | "employerType" | "orgName" | "phone" | "description" | "gender" | "age" | "hours" | "extras">;

/** "x_license" → "license" (kasbga xos savol kaliti) */
export function extraKeyOf(step: GuideStep): ExtraKey | null {
  return step.startsWith("x_") ? (step.slice(2) as ExtraKey) : null;
}

/** Shu savol bu e'lon uchun kerakmi (kasbga va oldingi javoblarga qarab) */
export function guideRelevant(step: GuideStep, d: View, keys: readonly ExtraKey[]): boolean {
  const x = extraKeyOf(step);
  if (x) return keys.includes(x);
  if (step === "schedule") return scheduleRelevant(d);
  if (step === "hours") return hoursRelevant({ remote: d.place.remote, extras: d.extras, schedule: d.schedule });
  return true;
}

/** Shu savolga javob bormi (kerak bo'lmagan savol — javob berilgan hisoblanadi) */
export function guideAnswered(step: GuideStep, d: View, asked: GuideAsked, keys: readonly ExtraKey[] = []): boolean {
  if (!guideRelevant(step, d, keys)) return true;
  const x = extraKeyOf(step);
  // masofaviy deb aytilgan bo'lsa — "ofisdami?" so'ralmaydi
  if (x) return !!d.extras?.[x] || (x === "format" && d.place.remote);
  switch (step) {
    case "profession":
      return !!(d.profession || d.custom);
    case "region":
      return d.place.remote || !!d.place.regionId;
    case "district":
      return d.place.remote || d.place.districtChosen;
    case "salary":
      return d.negotiable || parseMoney(d.salaryFrom) !== null || parseMoney(d.salaryTo) !== null;
    case "schedule":
      return !!d.schedule || asked.has("schedule");
    case "hours":
      return d.hours !== undefined;
    case "gender":
      return d.gender !== undefined;
    case "age":
      return d.age !== undefined;
    case "experience":
      return asked.has("experience");
    case "employerType":
      return !!d.employerType;
    case "orgName":
      return d.orgName.trim().length >= 2;
    case "phone":
      return !!normalizePhone(d.phone);
    case "notes":
      // ixtiyoriy ("Izohsiz" ham javob)
      return asked.has("notes");
    case "description":
      return asked.has("description") && d.description.trim().length >= 10;
    default:
      return true;
  }
}

/** Keyingi savol; hammasi bor bo'lsa — null (tekshirish va joylash) */
export function nextGuideStep(d: View, asked: GuideAsked, keys: readonly ExtraKey[] = []): GuideStep | null {
  return GUIDE_STEPS.find((s) => !guideAnswered(s, d, asked, keys)) ?? null;
}

/** Jarayon: nechta savolga javob bor (tepadagi chiziq uchun) — faqat shu e'longa kerakli savollar sanaladi */
export function guideProgress(d: View, asked: GuideAsked, keys: readonly ExtraKey[] = []): { done: number; total: number } {
  const steps = GUIDE_STEPS.filter((s) => guideRelevant(s, d, keys));
  return { done: steps.filter((s) => guideAnswered(s, d, asked, keys)).length, total: steps.length };
}

/** Maosh variantlari (so'm): oylik va kunlik. Bu bozor statistikasi emas — tez tanlash uchun yaxlit summalar */
export const SALARY_PRESETS = {
  monthly: [2_000_000, 3_000_000, 4_000_000, 5_000_000, 6_000_000, 8_000_000],
  daily: [100_000, 150_000, 200_000, 250_000, 300_000, 400_000],
} as const;

/**
 * AI yo'q bo'lsa (yoki matn bermasa) — e'lon matni yig'ilgan javoblardan: foydalanuvchining o'z gapi (bo'lsa) va qisqa faktlar.
 * Hech narsa qo'shib to'qilmaydi: faqat tanlangan narsalar.
 */
export function composeDescription(parts: { sentence: string; need: string; place: string | null; schedule: string | null; experience: string | null }): string {
  const own = parts.sentence.replace(/\s+/g, " ").trim();
  const first = own.length >= 15 ? sentenceCase(own) : parts.need;
  return [first, parts.place, parts.schedule, parts.experience].filter((x): x is string => !!x && x.trim().length > 0).join("\n");
}

function sentenceCase(s: string): string {
  const t = s.charAt(0).toLocaleUpperCase() + s.slice(1);
  return /[.!?…]$/.test(t) ? t : `${t}.`;
}
