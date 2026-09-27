/** Nomzod topilmaganda: filtrlarni bittadan yumshatish variantlari (sof modul). */
import { EMPTY_WORKER_SEARCH, type WorkerSearchParams } from "./search-params";

export type WorkerRelaxKey = "q" | "subcategory" | "category" | "district" | "region" | "salary" | "experience" | "schedule" | "employment" | "skills" | "languages" | "availability" | "education" | "gender" | "remote" | "distance" | "portfolio" | "verified" | "profession_only";

export function workerRelaxations(p: WorkerSearchParams): { key: WorkerRelaxKey; params: WorkerSearchParams }[] {
  const base = { ...p, page: 1 };
  const out: { key: WorkerRelaxKey; params: WorkerSearchParams }[] = [];
  const add = (key: WorkerRelaxKey, patch: Partial<WorkerSearchParams>) => out.push({ key, params: { ...base, ...patch } });
  if (p.q) add("q", { q: null, exact: false });
  if (p.subcategory) add("subcategory", { subcategory: null });
  else if (p.category) add("category", { category: null, subcategory: null, skills: [] });
  if (p.district.length) add("district", { district: [] });
  else if (p.region) add("region", { region: null, district: [] });
  if (p.max_km !== null) add("distance", { max_km: null });
  if (p.salary_max !== null) add("salary", { salary_max: null });
  if (p.experience_min !== null) add("experience", { experience_min: null });
  if (p.skills.length) add("skills", { skills: [] });
  if (p.schedule.length) add("schedule", { schedule: [] });
  if (p.employment.length) add("employment", { employment: [] });
  if (p.languages.length) add("languages", { languages: [] });
  if (p.availability.length) add("availability", { availability: [] });
  if (p.education_min) add("education", { education_min: null });
  if (p.gender) add("gender", { gender: null });
  if (p.remote !== null) add("remote", { remote: null });
  if (p.portfolio) add("portfolio", { portfolio: false });
  if (p.verified) add("verified", { verified: false });
  if (p.category && out.filter((o) => o.key !== "q" && o.key !== "subcategory" && o.key !== "category").length >= 2) {
    out.push({ key: "profession_only", params: { ...EMPTY_WORKER_SEARCH, q: p.q, category: p.category, subcategory: p.subcategory, vacancy: p.vacancy, sort: p.sort } });
  }
  return out;
}
