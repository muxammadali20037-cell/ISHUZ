import type { Json } from "@/types/database.types";
import type { WorkerCardData } from "@/components/shared/worker-card";
import type { VacancyCardData } from "@/components/shared/vacancy-card";
import type { DashboardStats, SearchWorkerRow, SearchVacancyRow } from "./types";

/** RPC/JSON natijalarini UI tiplariga keltiradigan pure funksiyalar (testlanadi). */

const EMPTY_STATS: DashboardStats = {
  active_vacancies: 0,
  total_vacancies: 0,
  applications: 0,
  new_applications: 0,
  views: 0,
  saved_workers: 0,
  offers_sent: 0,
  hired: 0,
};

function toInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Math.trunc(Number(v));
  return 0;
}

/** employer_dashboard_stats() jsonb → DashboardStats (yetishmagan kalitlar 0) */
export function parseDashboardStats(json: Json | null | undefined): DashboardStats {
  if (!json || typeof json !== "object" || Array.isArray(json)) return { ...EMPTY_STATS };
  const obj = json as Record<string, Json | undefined>;
  return {
    active_vacancies: toInt(obj.active_vacancies),
    total_vacancies: toInt(obj.total_vacancies),
    applications: toInt(obj.applications),
    new_applications: toInt(obj.new_applications),
    views: toInt(obj.views),
    saved_workers: toInt(obj.saved_workers),
    offers_sent: toInt(obj.offers_sent),
    hired: toInt(obj.hired),
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseSkills(json: Json | null | undefined): WorkerCardData["skills"] {
  if (!Array.isArray(json)) return [];
  const out: NonNullable<WorkerCardData["skills"]> = [];
  for (const item of json) {
    if (!isRecord(item)) continue;
    const { id, name_uz, name_ru, level } = item;
    if (typeof id !== "string") continue;
    out.push({
      id,
      name_uz: typeof name_uz === "string" ? name_uz : "",
      name_ru: typeof name_ru === "string" ? name_ru : "",
      level: typeof level === "string" ? level : "",
    });
  }
  return out;
}

function parseLanguages(json: Json | null | undefined): WorkerCardData["languages"] {
  if (!Array.isArray(json)) return [];
  const out: NonNullable<WorkerCardData["languages"]> = [];
  for (const item of json) {
    if (!isRecord(item)) continue;
    const { code, level } = item;
    if (typeof code !== "string") continue;
    out.push({ code, level: typeof level === "string" ? level : "" });
  }
  return out;
}

/** search_workers qatori → WorkerCard ma'lumoti */
export function toWorkerCardData(row: SearchWorkerRow): WorkerCardData {
  return {
    id: row.id,
    first_name: row.first_name ?? "",
    last_initial: row.last_initial ?? null,
    avatar_url: row.avatar_url ?? null,
    headline: row.headline ?? null,
    category_name_uz: row.category_name_uz ?? null,
    category_name_ru: row.category_name_ru ?? null,
    region_name_uz: row.region_name_uz ?? null,
    region_name_ru: row.region_name_ru ?? null,
    district_name_uz: row.district_name_uz ?? null,
    district_name_ru: row.district_name_ru ?? null,
    experience_level: row.experience_level,
    status: row.status,
    salary_min: row.salary_min ?? null,
    salary_expected: row.salary_expected ?? null,
    employment_types: row.employment_types ?? null,
    skills: parseSkills(row.skills),
    languages: parseLanguages(row.languages),
    has_portfolio: row.has_portfolio ?? null,
    phone_verified: row.phone_verified ?? null,
    match_score: row.match_score ?? null,
    distance_km: row.distance_km ?? null,
    is_saved: row.is_saved ?? null,
  };
}

/** search_vacancies qatori → VacancyCard ma'lumoti */
export function toVacancyCardData(row: SearchVacancyRow): VacancyCardData {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    company_name: row.company_name ?? null,
    company_logo_url: row.company_logo_url ?? null,
    company_verified: row.company_verified ?? null,
    region_name_uz: row.region_name_uz ?? null,
    region_name_ru: row.region_name_ru ?? null,
    district_name_uz: row.district_name_uz ?? null,
    district_name_ru: row.district_name_ru ?? null,
    is_remote: row.is_remote ?? false,
    salary_from: row.salary_from ?? null,
    salary_to: row.salary_to ?? null,
    salary_type: row.salary_type,
    salary_negotiable: row.salary_negotiable ?? false,
    employment_type: row.employment_type,
    schedule: row.schedule,
    work_time_from: row.work_time_from ?? null,
    work_time_to: row.work_time_to ?? null,
    work_format: row.work_format,
    benefits: row.benefits ?? null,
    published_at: row.published_at ?? null,
    match_score: row.match_score ?? null,
    is_saved: row.is_saved ?? null,
    has_applied: row.has_applied ?? null,
    is_featured: row.is_featured ?? null,
  };
}

/** Ish beruvchi ko'rinadigan nomi: kompaniya → display_name → ism */
export function employerDisplayName(input: { companyName?: string | null; displayName?: string | null; firstName?: string | null }): string {
  return (input.companyName ?? "").trim() || (input.displayName ?? "").trim() || (input.firstName ?? "").trim();
}

/** Xatolik kodini i18n kalitiga aylantiradi (modul yoki umumiy) */
const MODULE_ERRORS = new Set(["company_exists", "not_admin", "owner_locked", "invalid_path", "already_pending", "invite_invalid"]);
const COMMON_ERRORS = new Set(["generic", "network", "forbidden", "not_authenticated", "rate_limited", "blocked", "validation", "invalid_phone", "invalid_url", "file_too_large", "file_type"]);

export function errorMessageKey(code: string): string {
  if (MODULE_ERRORS.has(code)) return `employer.errors.${code}`;
  if (COMMON_ERRORS.has(code)) return `common.errors.${code}`;
  if (code === "employer_only") return "common.errors.forbidden";
  return "common.errors.generic";
}
