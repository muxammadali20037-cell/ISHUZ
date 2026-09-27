/**
 * "Hech narsa topilmadi" holati uchun: har bir filtrni bittadan yumshatib ko'rish variantlari.
 * Natija soni server tomonda hisoblanadi; bu yerda faqat variantlar (sof modul).
 */
import { DEFAULT_JOBS_PARAMS, type JobsSearchParams } from "./search-params";

export type RelaxKey = "q" | "subcategory" | "category" | "district" | "region" | "salary" | "schedule" | "employment" | "experience" | "no_experience" | "remote" | "format" | "benefits" | "verified" | "government" | "profession_only";

export function jobsRelaxations(p: JobsSearchParams): { key: RelaxKey; params: JobsSearchParams }[] {
  const base = { ...p, page: 1 };
  const out: { key: RelaxKey; params: JobsSearchParams }[] = [];
  const add = (key: RelaxKey, patch: Partial<JobsSearchParams>) => out.push({ key, params: { ...base, ...patch } });
  if (p.q) add("q", { q: "", exact: false });
  if (p.subcategory) add("subcategory", { subcategory: null });
  else if (p.category) add("category", { category: null, subcategory: null });
  if (p.district.length) add("district", { district: [] });
  else if (p.region) add("region", { region: null, district: [] });
  if (p.salaryMin) add("salary", { salaryMin: null });
  if (p.schedule.length) add("schedule", { schedule: [] });
  if (p.employment.length) add("employment", { employment: [] });
  if (p.experienceMax !== null) add("experience", { experienceMax: null });
  if (p.noExperience) add("no_experience", { noExperience: false });
  if (p.remote) add("remote", { remote: false });
  if (p.format) add("format", { format: null });
  if (p.benefits.length) add("benefits", { benefits: [] });
  if (p.verified) add("verified", { verified: false });
  if (p.government) add("government", { government: false });
  // Bittadan olib tashlash yetmasa: faqat kasb (va matn) qoladi
  if (p.category && out.filter((o) => o.key !== "q" && o.key !== "subcategory" && o.key !== "category").length >= 2) {
    out.push({ key: "profession_only", params: { ...DEFAULT_JOBS_PARAMS, q: p.q, category: p.category, subcategory: p.subcategory, sort: p.sort } });
  }
  return out;
}
