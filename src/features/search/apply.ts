/**
 * Tushunilgan so'rov → mavjud qidiruv filtrlari (URL). Foydalanuvchi o'zi qo'ygan filtrlar ustun:
 * faqat bo'sh maydonlar to'ldiriladi. Hech narsa tushunilmasa null (qidiruv o'zgarmaydi).
 * Sof modul — vitest bilan testlanadi.
 */
import { EXPERIENCE_MAX_OPTIONS, type JobsSearchParams } from "@/features/jobs/search-params";
import { EXPERIENCE_MIN_OPTIONS, type WorkerSearchParams } from "@/features/workers/search-params";
import type { SalaryKind, Understood } from "./understand";

/** Kunlik/soatlik maosh → oylik ekvivalent (SQL: salary_monthly_equivalent bilan bir xil) */
export function monthlyEquivalent(amount: number, kind: SalaryKind | null): number {
  if (kind === "daily") return amount * 22;
  if (kind === "hourly") return amount * 176;
  return amount;
}

export function applyUnderstoodToJobs(p: JobsSearchParams, u: Understood, original: string): JobsSearchParams | null {
  if (!u.any) return null;
  const next: JobsSearchParams = { ...p, q: u.rest, page: 1, from: original, exact: false };
  if (!p.category && u.category) {
    next.category = u.category.slug;
    next.subcategory = u.subcategory?.slug ?? null;
  }
  if (!p.region && u.region) next.region = u.region.slug;
  if (!p.district.length && u.districts.length && (!p.region || p.region === u.region?.slug)) next.district = u.districts.map((d) => d.id);
  if (!p.salaryMin && u.salaryMin) next.salaryMin = monthlyEquivalent(u.salaryMin, u.salaryKind);
  if (!p.schedule.length && u.schedules.length) next.schedule = u.schedules;
  if (!p.employment.length && u.employment.length) next.employment = u.employment;
  if (!p.remote && u.remote) next.remote = true;
  if (!p.noExperience && u.noExperience) next.noExperience = true;
  // Ish qidiruvchi: "3 yil tajribam bor" → shu tajribagacha talab qiladigan vakansiyalar
  if (p.experienceMax === null && u.experienceMonths !== null && !u.noExperience) {
    next.experienceMax = EXPERIENCE_MAX_OPTIONS.find((o) => o >= u.experienceMonths!) ?? null;
  }
  return next;
}

/**
 * Ish beruvchi: "2 yildan ko'p tajribali oshpaz, Chilonzor, 5 mln gacha" → nomzodlar filtrlari.
 * Maosh raqami — ish beruvchining byudjeti (salary_max).
 */
export function applyUnderstoodToWorkers(p: WorkerSearchParams, u: Understood, original: string): WorkerSearchParams | null {
  if (!u.any) return null;
  const next: WorkerSearchParams = { ...p, q: u.rest || null, page: 1, from: original, exact: false };
  if (!p.category && u.category) {
    next.category = u.category.slug;
    next.subcategory = u.subcategory?.slug ?? null;
  }
  if (!p.region && u.region) next.region = u.region.slug;
  if (!p.district.length && u.districts.length && (!p.region || p.region === u.region?.slug)) next.district = u.districts.map((d) => d.id);
  if (p.salary_max === null && u.salaryMin) next.salary_max = monthlyEquivalent(u.salaryMin, u.salaryKind);
  if (!p.schedule.length && u.schedules.length) next.schedule = u.schedules;
  if (!p.employment.length && u.employment.length) next.employment = u.employment;
  if (p.remote === null && u.remote) next.remote = true;
  if (p.experience_min === null && u.experienceMonths !== null) {
    next.experience_min = [...EXPERIENCE_MIN_OPTIONS].reverse().find((o) => o <= u.experienceMonths!) ?? null;
  }
  return next;
}
