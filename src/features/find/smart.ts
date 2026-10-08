/**
 * Aqlli qidiruv: qoidalar (lug'at) natijasi + AI tahlili → /search parametrlari (sof modul, testlanadi).
 * AI faqat matndagi niyat va so'zlarni ajratadi; kasb/hudud ID'lari bazadagi ma'lumotnomadan olinadi,
 * natijalar esa doim haqiqiy e'lonlardan. Kunlik/soatlik maosh oylik filtrga tenglashtirilmaydi.
 */
import { keepSalary, mentionsExperience, mentionsSchedule } from "@/features/post/ai-guard";
import { normalizeText } from "@/features/search/understand";
import type { FindMode } from "./intent";

export type SmartSchedule = "5_2" | "6_1" | "2_2" | "shift" | "flexible";

/** Qoidalar natijasi (resolveFindQuery) */
export interface RulesResolved {
  mode: FindMode | null;
  nodeId: string | null;
  regionSlug: string | null;
  districtId: string | null;
  remote: boolean;
  salaryMin: number | null;
  salaryKind: "monthly" | "daily" | "hourly" | null;
  schedules: SmartSchedule[];
  noExperience: boolean;
  experienceMonths: number | null;
}

/** AI tahlili (qat'iy sxemadan o'tgan) */
export interface AiSearchParse {
  intent: FindMode | null;
  profession: string | null;
  specialization: string | null;
  region: string | null;
  district: string | null;
  remote: boolean | null;
  salary_min: number | null;
  pay_period: "month" | "day" | "hour" | null;
  experience: "none" | "experienced" | null;
  schedule: SmartSchedule | null;
  employment: "full_time" | "part_time" | "temporary" | null;
  skills: string[];
}

export interface SmartFilters {
  salary: number | null;
  schedule: SmartSchedule | null;
  noexp: boolean;
  exp: boolean;
}

const REMOTE_HINT = /(masofa|remote|udal|uydan|onlayn|online|distan)/;

/** AI kerakmi: kasb topilmadi, raqam bor-u maosh tushunilmadi, yoki uzun tabiiy gap */
export function needsAi(q: string, rules: RulesResolved): boolean {
  const words = normalizeText(q).split(" ").filter(Boolean).length;
  if (words < 1) return false;
  if (!rules.nodeId) return true;
  if (/\d/.test(q) && rules.salaryMin == null) return true;
  return words >= 7;
}

/** AI masofaviy ish deb aytsa ham, matnda shunga ishora bo'lishi shart */
export function aiRemote(q: string, ai: AiSearchParse | null): boolean {
  return ai?.remote === true && REMOTE_HINT.test(normalizeText(q));
}

/**
 * Filtrlar: avval qoidalar, keyin AI (faqat matnda asosi bo'lsa).
 * Maosh filtri oylik: kunlik/soatlik summa oylikka aylantirilmaydi va qo'llanmaydi.
 */
export function smartFilters(q: string, mode: FindMode | null, rules: RulesResolved, ai: AiSearchParse | null): SmartFilters {
  let salary: number | null = null;
  if (rules.salaryMin && (rules.salaryKind ?? "monthly") === "monthly") salary = rules.salaryMin;
  else if (!rules.salaryMin && ai?.salary_min && (ai.pay_period ?? "month") === "month") salary = keepSalary(ai.salary_min, q);
  const schedule = rules.schedules[0] ?? (ai?.schedule && mentionsSchedule(q) ? ai.schedule : null);
  const expHint = mentionsExperience(q) || /(tajribasiz|без опыта|bez opyta)/.test(q.toLowerCase());
  const noexp = mode === "jobs" && (rules.noExperience || (ai?.experience === "none" && expHint));
  const exp = mode === "workers" && (!!rules.experienceMonths || (ai?.experience === "experienced" && expHint));
  return { salary: mode === "jobs" ? salary : null, schedule: mode === "jobs" ? schedule : null, noexp, exp };
}

/** Kasbni bazadan topish uchun AI so'zlari (aniqrog'i birinchi) */
export function professionQueries(ai: AiSearchParse | null): string[] {
  if (!ai?.profession) return [];
  const p = ai.profession.trim().slice(0, 60);
  const s = ai.specialization?.trim().slice(0, 60);
  return [...new Set([s ? `${s} ${p}` : null, s, p].filter((x): x is string => !!x && x.length >= 2))];
}
