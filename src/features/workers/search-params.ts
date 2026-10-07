/**
 * /workers URL holati: searchParams ↔ WorkerSearchParams.
 * Sof funksiyalar (server va client'da bir xil), vitest bilan testlanadi.
 */
import type { Enums } from "@/types/database.types";

export const WORKER_SORTS = ["relevant", "newest", "distance"] as const;
export type WorkerSort = (typeof WORKER_SORTS)[number];

export const SCHEDULES: Enums<"work_schedule">[] = ["5_2", "6_1", "2_2", "shift", "flexible", "negotiable"];
export const EMPLOYMENT_TYPES: Enums<"employment_type">[] = ["permanent", "temporary", "part_time", "full_time", "shift", "remote", "freelance", "internship"];
export const WORK_FORMATS: Enums<"work_format">[] = ["official", "unofficial", "any"];
export const GENDERS: Enums<"gender">[] = ["male", "female"];
export const EDUCATION_LEVELS: Enums<"education_level">[] = ["secondary", "vocational", "incomplete_higher", "higher", "master"];
export const WORKER_STATUSES: Enums<"worker_status">[] = ["active", "open", "not_looking"];
export const AVAILABILITIES: Enums<"availability">[] = ["today", "tomorrow", "within_3_days", "within_week", "negotiable"];
export const EXPERIENCE_MIN_OPTIONS = [0, 6, 12, 24, 36, 60] as const;
export const SALARY_MAX_PRESETS = [2_000_000, 3_000_000, 5_000_000, 7_000_000, 10_000_000, 15_000_000, 20_000_000] as const;
export const MAX_KM_OPTIONS = [3, 5, 10, 15, 25, 50] as const;
export const DEFAULT_STATUSES: Enums<"worker_status">[] = ["active", "open"];
export const PAGE_SIZE = 20;

export interface WorkerSearchParams {
  q: string | null;
  category: string | null;
  subcategory: string | null;
  /** profession_nodes.slug — soha ichidagi yo'nalish */
  profession: string | null;
  region: string | null;
  district: string[];
  experience_min: number | null;
  salary_max: number | null;
  schedule: Enums<"work_schedule">[];
  employment: Enums<"employment_type">[];
  format: Enums<"work_format"> | null;
  gender: Enums<"gender"> | null;
  education_min: Enums<"education_level"> | null;
  languages: string[];
  skills: string[];
  status: Enums<"worker_status">[];
  availability: Enums<"availability">[];
  portfolio: boolean;
  verified: boolean;
  remote: boolean | null;
  vacancy: string | null;
  lat: number | null;
  lng: number | null;
  max_km: number | null;
  sort: WorkerSort;
  page: number;
  /** Matnni filtrlarga aylantirmasdan aynan qidirish */
  exact: boolean;
  /** Filtrlarga aylantirilgan asl so'rov */
  from: string;
}

export type RawSearchParams = Record<string, string | string[] | undefined> | URLSearchParams;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9_-]{1,64}$/i;
const LANG_RE = /^[a-z]{2,3}$/i;

export function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

function first(raw: RawSearchParams, key: string): string | undefined {
  if (raw instanceof URLSearchParams) return raw.get(key) ?? undefined;
  const v = raw[key];
  return Array.isArray(v) ? v[0] : v;
}

/** "a,b, c" → ["a","b","c"] (bo'shlarni tashlaydi, takrorlarni olib tashlaydi) */
function csv(value: string | undefined): string[] {
  if (!value) return [];
  return [...new Set(value.split(",").map((s) => s.trim()).filter(Boolean))];
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | null {
  if (!value) return null;
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function manyOf<T extends string>(value: string | undefined, allowed: readonly T[]): T[] {
  return csv(value).filter((v): v is T => (allowed as readonly string[]).includes(v));
}

function intOrNull(value: string | undefined, opts: { min?: number; max?: number } = {}): number | null {
  if (value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (opts.min !== undefined && i < opts.min) return null;
  if (opts.max !== undefined && i > opts.max) return null;
  return i;
}

function floatOrNull(value: string | undefined, min: number, max: number): number | null {
  if (value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

function flag(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

function triState(value: string | undefined): boolean | null {
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return null;
}

/** URL searchParams → tekshirilgan filtr obyekti. Noto'g'ri qiymatlar jimgina tashlab yuboriladi. */
export function parseWorkerSearchParams(raw: RawSearchParams): WorkerSearchParams {
  const q = (first(raw, "q") ?? "").trim().slice(0, 100);
  const category = first(raw, "category");
  const subcategory = first(raw, "subcategory");
  const profession = first(raw, "profession");
  const region = first(raw, "region");
  const vacancy = first(raw, "vacancy");
  const lat = floatOrNull(first(raw, "lat"), -90, 90);
  const lng = floatOrNull(first(raw, "lng"), -180, 180);
  const hasCoords = lat !== null && lng !== null;
  const statuses = manyOf(first(raw, "status"), WORKER_STATUSES);
  const maxKm = intOrNull(first(raw, "max_km"), { min: 1, max: 500 });

  return {
    q: q || null,
    category: category && SLUG_RE.test(category) ? category : null,
    subcategory: subcategory && SLUG_RE.test(subcategory) ? subcategory : null,
    profession: profession && SLUG_RE.test(profession) ? profession : null,
    region: region && SLUG_RE.test(region) ? region : null,
    district: csv(first(raw, "district")).filter(isUuid).slice(0, 30),
    experience_min: intOrNull(first(raw, "experience_min"), { min: 0, max: 600 }),
    salary_max: intOrNull(first(raw, "salary_max"), { min: 1, max: 1_000_000_000 }),
    schedule: manyOf(first(raw, "schedule"), SCHEDULES),
    employment: manyOf(first(raw, "employment"), EMPLOYMENT_TYPES),
    format: oneOf(first(raw, "format"), WORK_FORMATS),
    gender: oneOf(first(raw, "gender"), GENDERS),
    education_min: oneOf(first(raw, "education_min"), EDUCATION_LEVELS),
    languages: csv(first(raw, "languages")).filter((c) => LANG_RE.test(c)).map((c) => c.toLowerCase()).slice(0, 10),
    skills: csv(first(raw, "skills")).filter(isUuid).slice(0, 30),
    status: statuses.length ? statuses : [...DEFAULT_STATUSES],
    availability: manyOf(first(raw, "availability"), AVAILABILITIES),
    portfolio: flag(first(raw, "portfolio")),
    verified: flag(first(raw, "verified")),
    remote: triState(first(raw, "remote")),
    vacancy: vacancy && isUuid(vacancy) ? vacancy : null,
    lat: hasCoords ? lat : null,
    lng: hasCoords ? lng : null,
    max_km: maxKm,
    sort: oneOf(first(raw, "sort"), WORKER_SORTS) ?? "relevant",
    page: intOrNull(first(raw, "page"), { min: 1, max: 10_000 }) ?? 1,
    exact: flag(first(raw, "exact")),
    from: (first(raw, "from") ?? "").replace(/\s+/g, " ").trim().slice(0, 100),
  };
}

export const EMPTY_WORKER_SEARCH: WorkerSearchParams = parseWorkerSearchParams({});

function sameSet(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((v) => b.includes(v));
}

/** Filtr obyekti → URL query (standart qiymatlar yozilmaydi). Bo'sh bo'lsa "" qaytadi. */
export function serializeWorkerSearchParams(p: Partial<WorkerSearchParams>): string {
  const sp = new URLSearchParams();
  const set = (k: string, v: string | null | undefined) => {
    if (v !== null && v !== undefined && v !== "") sp.set(k, v);
  };
  set("q", p.q);
  set("category", p.category);
  set("subcategory", p.subcategory);
  set("profession", p.profession);
  set("region", p.region);
  if (p.district?.length) set("district", p.district.join(","));
  if (p.experience_min !== null && p.experience_min !== undefined) set("experience_min", String(p.experience_min));
  if (p.salary_max !== null && p.salary_max !== undefined) set("salary_max", String(p.salary_max));
  if (p.schedule?.length) set("schedule", p.schedule.join(","));
  if (p.employment?.length) set("employment", p.employment.join(","));
  set("format", p.format);
  set("gender", p.gender);
  set("education_min", p.education_min);
  if (p.languages?.length) set("languages", p.languages.join(","));
  if (p.skills?.length) set("skills", p.skills.join(","));
  if (p.status?.length && !sameSet(p.status, DEFAULT_STATUSES)) set("status", p.status.join(","));
  if (p.availability?.length) set("availability", p.availability.join(","));
  if (p.portfolio) set("portfolio", "1");
  if (p.verified) set("verified", "1");
  if (p.remote !== null && p.remote !== undefined) set("remote", p.remote ? "1" : "0");
  set("vacancy", p.vacancy);
  if (p.lat !== null && p.lat !== undefined && p.lng !== null && p.lng !== undefined) {
    set("lat", String(Math.round(p.lat * 10_000) / 10_000));
    set("lng", String(Math.round(p.lng * 10_000) / 10_000));
  }
  if (p.max_km !== null && p.max_km !== undefined) set("max_km", String(p.max_km));
  if (p.sort && p.sort !== "relevant") set("sort", p.sort);
  if (p.page && p.page > 1) set("page", String(p.page));
  if (p.exact) set("exact", "1");
  set("from", p.from);
  return sp.toString();
}

/** Yangi filtr bilan URL: sahifa 1 ga qaytadi (page ochiq berilmasa) */
export function buildWorkersUrl(base: WorkerSearchParams, patch: Partial<WorkerSearchParams>, pathname = "/workers"): string {
  const next: WorkerSearchParams = { ...base, ...patch, page: patch.page ?? 1 };
  const qs = serializeWorkerSearchParams(next);
  return qs ? `${pathname}?${qs}` : pathname;
}

/** Faol filtrlar soni ("Barcha filtrlar (3)" uchun). q, vacancy, sort, page hisobga olinmaydi. */
export function countActiveFilters(p: WorkerSearchParams): number {
  let n = 0;
  if (p.category) n++;
  if (p.subcategory) n++;
  if (p.profession) n++;
  if (p.region) n++;
  if (p.district.length) n++;
  if (p.experience_min !== null) n++;
  if (p.salary_max !== null) n++;
  if (p.schedule.length) n++;
  if (p.employment.length) n++;
  if (p.format) n++;
  if (p.gender) n++;
  if (p.education_min) n++;
  if (p.languages.length) n++;
  if (p.skills.length) n++;
  if (!sameSet(p.status, DEFAULT_STATUSES)) n++;
  if (p.availability.length) n++;
  if (p.portfolio) n++;
  if (p.verified) n++;
  if (p.remote !== null) n++;
  if (p.max_km !== null) n++;
  return n;
}

/** Barcha filtrlarni tozalash (q, vacancy va joylashuv koordinatalari saqlanadi) */
export function clearFilters(p: WorkerSearchParams): WorkerSearchParams {
  return { ...EMPTY_WORKER_SEARCH, q: p.q, vacancy: p.vacancy, lat: p.lat, lng: p.lng, sort: p.sort === "distance" && p.lat === null ? "relevant" : p.sort, page: 1 };
}
