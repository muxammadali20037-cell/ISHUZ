/**
 * /jobs URL holati: parse → JobsSearchParams → search_vacancies RPC argumentlari.
 * Sof modul (runtime import yo'q) — vitest bilan testlanadi.
 *
 * URL: /jobs?q=kassir&category=sales&subcategory=cashier&region=tashkent_city&district=<uuid>,<uuid>
 *      &salary_min=5000000&employment=full_time,part_time&schedule=5_2,6_1&format=official
 *      &experience_max=12&remote=1&benefits=food,transport&verified=1&gov=1&no_experience=1&sort=newest&page=2
 */
import type { Database, Enums } from "@/types/database.types";

export type SortKey = "relevant" | "newest" | "salary";
export type FormatKey = "official" | "unofficial";
export type EmploymentType = Enums<"employment_type">;
export type WorkSchedule = Enums<"work_schedule">;

export const PAGE_SIZE = 20;
export const MAX_PAGE = 500;
export const SORT_KEYS: readonly SortKey[] = ["relevant", "newest", "salary"];
export const FORMAT_KEYS: readonly FormatKey[] = ["official", "unofficial"];
export const EMPLOYMENT_TYPES: readonly EmploymentType[] = ["full_time", "part_time", "permanent", "temporary", "shift", "remote", "freelance", "internship"];
export const SCHEDULES: readonly WorkSchedule[] = ["5_2", "6_1", "2_2", "shift", "flexible", "negotiable"];
/** experience_max (oy): "shuncha oygacha tajriba talab qiladigan" vakansiyalar */
export const EXPERIENCE_MAX_OPTIONS = [0, 6, 12, 24, 36, 60] as const;
export const SALARY_PRESETS = [2_000_000, 3_000_000, 5_000_000, 7_000_000, 10_000_000, 15_000_000] as const;
export const SALARY_MAX = 1_000_000_000;

export interface JobsSearchParams {
  q: string;
  /** categories.slug */
  category: string | null;
  /** subcategories.slug */
  subcategory: string | null;
  /** regions.slug */
  region: string | null;
  /** districts.id (uuid) ro'yxati */
  district: string[];
  salaryMin: number | null;
  employment: EmploymentType[];
  schedule: WorkSchedule[];
  format: FormatKey | null;
  experienceMax: number | null;
  remote: boolean;
  /** benefits.code ro'yxati */
  benefits: string[];
  verified: boolean;
  /** Faqat tasdiqlangan davlat tashkilotlari */
  government: boolean;
  noExperience: boolean;
  sort: SortKey;
  page: number;
  /** Matnni filtrlarga aylantirmasdan aynan qidirish */
  exact: boolean;
  /** Filtrlarga aylantirilgan asl so'rov (foydalanuvchiga ko'rsatish uchun) */
  from: string;
}

export type RawSearchParams = Record<string, string | string[] | undefined> | URLSearchParams;
export type SearchVacanciesArgs = Database["public"]["Functions"]["search_vacancies"]["Args"];

export const DEFAULT_JOBS_PARAMS: JobsSearchParams = {
  q: "",
  category: null,
  subcategory: null,
  region: null,
  district: [],
  salaryMin: null,
  employment: [],
  schedule: [],
  format: null,
  experienceMax: null,
  remote: false,
  benefits: [],
  verified: false,
  government: false,
  noExperience: false,
  sort: "relevant",
  page: 1,
  exact: false,
  from: "",
};

const SLUG_RE = /^[a-z0-9_-]{1,64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_RE = /^[a-z0-9_]{1,40}$/;

function first(raw: RawSearchParams, key: string): string | undefined {
  if (raw instanceof URLSearchParams) return raw.get(key) ?? undefined;
  const v = raw[key];
  return Array.isArray(v) ? v[0] : v;
}

function csv(value: string | undefined): string[] {
  if (!value) return [];
  const out: string[] = [];
  for (const part of value.split(",")) {
    const p = part.trim();
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

function pickEnum<T extends string>(values: string[], allowed: readonly T[]): T[] {
  return values.filter((v): v is T => (allowed as readonly string[]).includes(v));
}

function slug(value: string | undefined): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  return SLUG_RE.test(v) ? v : null;
}

function bool(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

function int(value: string | undefined, min: number, max: number): number | null {
  if (value === undefined || value === "") return null;
  const n = Number.parseInt(value.replace(/\s/g, ""), 10);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

/** URL parametrlarini xavfsiz JobsSearchParams ga aylantiradi (noto'g'ri qiymatlar tashlab yuboriladi) */
export function parseJobsSearchParams(raw: RawSearchParams): JobsSearchParams {
  const q = (first(raw, "q") ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  const sortRaw = first(raw, "sort");
  const sort: SortKey = (SORT_KEYS as readonly string[]).includes(sortRaw ?? "") ? (sortRaw as SortKey) : "relevant";
  const formatRaw = first(raw, "format");
  const format: FormatKey | null = (FORMAT_KEYS as readonly string[]).includes(formatRaw ?? "") ? (formatRaw as FormatKey) : null;
  const experienceRaw = int(first(raw, "experience_max"), 0, 240);
  const experienceMax = experienceRaw !== null && (EXPERIENCE_MAX_OPTIONS as readonly number[]).includes(experienceRaw) ? experienceRaw : null;

  return {
    q,
    category: slug(first(raw, "category")),
    subcategory: slug(first(raw, "subcategory")),
    region: slug(first(raw, "region")),
    district: csv(first(raw, "district"))
      .filter((d) => UUID_RE.test(d))
      .slice(0, 30),
    salaryMin: int(first(raw, "salary_min"), 1, SALARY_MAX),
    employment: pickEnum(csv(first(raw, "employment")), EMPLOYMENT_TYPES),
    schedule: pickEnum(csv(first(raw, "schedule")), SCHEDULES),
    format,
    experienceMax,
    remote: bool(first(raw, "remote")),
    benefits: csv(first(raw, "benefits"))
      .filter((b) => CODE_RE.test(b))
      .slice(0, 20),
    verified: bool(first(raw, "verified")),
    government: bool(first(raw, "gov")),
    noExperience: bool(first(raw, "no_experience")),
    sort,
    page: int(first(raw, "page"), 1, MAX_PAGE) ?? 1,
    exact: bool(first(raw, "exact")),
    from: (first(raw, "from") ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
  };
}

/** JobsSearchParams → query string (standart qiymatlar tushirib qoldiriladi). Bo'sh bo'lsa "" */
export function serializeJobsSearchParams(params: Partial<JobsSearchParams>): string {
  const p = { ...DEFAULT_JOBS_PARAMS, ...params };
  const sp = new URLSearchParams();
  if (p.q) sp.set("q", p.q);
  if (p.category) sp.set("category", p.category);
  if (p.subcategory) sp.set("subcategory", p.subcategory);
  if (p.region) sp.set("region", p.region);
  if (p.district.length) sp.set("district", p.district.join(","));
  if (p.salaryMin) sp.set("salary_min", String(p.salaryMin));
  if (p.employment.length) sp.set("employment", p.employment.join(","));
  if (p.schedule.length) sp.set("schedule", p.schedule.join(","));
  if (p.format) sp.set("format", p.format);
  if (p.experienceMax !== null) sp.set("experience_max", String(p.experienceMax));
  if (p.remote) sp.set("remote", "1");
  if (p.benefits.length) sp.set("benefits", p.benefits.join(","));
  if (p.verified) sp.set("verified", "1");
  if (p.government) sp.set("gov", "1");
  if (p.noExperience) sp.set("no_experience", "1");
  if (p.sort !== "relevant") sp.set("sort", p.sort);
  if (p.page > 1) sp.set("page", String(p.page));
  if (p.exact) sp.set("exact", "1");
  if (p.from) sp.set("from", p.from);
  return sp.toString();
}

/** /jobs?... havolasi. `overrides` bilan bitta parametrni o'zgartirish qulay: jobsHref(params, { page: 2 }) */
export function jobsHref(params: Partial<JobsSearchParams>, overrides?: Partial<JobsSearchParams>): string {
  const qs = serializeJobsSearchParams({ ...params, ...overrides });
  return qs ? `/jobs?${qs}` : "/jobs";
}

/** Faol filtrlar soni (q, sort, page hisobga olinmaydi) */
export function countActiveFilters(p: JobsSearchParams): number {
  let n = 0;
  if (p.category) n++;
  if (p.subcategory) n++;
  if (p.region) n++;
  if (p.district.length) n++;
  if (p.salaryMin) n++;
  if (p.employment.length) n++;
  if (p.schedule.length) n++;
  if (p.format) n++;
  if (p.experienceMax !== null) n++;
  if (p.remote) n++;
  if (p.benefits.length) n++;
  if (p.verified) n++;
  if (p.government) n++;
  if (p.noExperience) n++;
  return n;
}

/** Filtrlarni tozalash: q va sort saqlanadi, page 1 ga qaytadi */
export function clearFilters(p: JobsSearchParams): JobsSearchParams {
  return { ...DEFAULT_JOBS_PARAMS, q: p.q, sort: p.sort };
}

export interface ResolvedIds {
  categoryId?: string | null;
  subcategoryId?: string | null;
  regionId?: string | null;
}

/** Slug'lar id ga aylantirilgach RPC argumentlari */
export function toSearchVacanciesArgs(p: JobsSearchParams, ids: ResolvedIds, limit = PAGE_SIZE): SearchVacanciesArgs {
  const args: SearchVacanciesArgs = {
    p_sort: p.sort,
    p_limit: limit,
    p_offset: (p.page - 1) * limit,
    p_verified_only: p.verified,
    p_government_only: p.government,
    p_no_experience: p.noExperience,
  };
  if (p.q) args.p_query = p.q;
  if (ids.categoryId) args.p_category_id = ids.categoryId;
  if (ids.subcategoryId) args.p_subcategory_id = ids.subcategoryId;
  if (ids.regionId) args.p_region_id = ids.regionId;
  if (p.district.length) args.p_district_ids = p.district;
  if (p.salaryMin) args.p_salary_min = p.salaryMin;
  if (p.employment.length) args.p_employment_types = p.employment;
  if (p.schedule.length) args.p_schedules = p.schedule;
  if (p.format) args.p_work_format = p.format;
  if (p.experienceMax !== null) args.p_experience_max_months = p.experienceMax;
  if (p.remote) args.p_is_remote = true;
  if (p.benefits.length) args.p_benefits = p.benefits;
  return args;
}

/** Nomlarni solishtirish uchun normallashtirish: kichik harf, apostrof/tire/bo'shliqlar birxillashtiriladi */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘`ʻʼ']/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

interface NamedRef {
  slug: string;
  name_uz: string;
  name_ru: string;
}

/**
 * "Aqlli qidiruv": q kategoriya yoki yo'nalish nomiga (uz/ru, katta-kichik harf farqsiz) teng bo'lsa —
 * kategoriya filtri avtomatik qo'yiladi. q o'z holicha qoladi.
 */
export function matchQueryToCategory<C extends NamedRef, S extends NamedRef & { category_id: string }>(
  q: string,
  categories: readonly (C & { id: string })[],
  subcategories: readonly S[],
): { category: C & { id: string }; subcategory: S | null } | null {
  const needle = normalizeName(q);
  if (needle.length < 2) return null;
  const eq = (r: NamedRef) => normalizeName(r.name_uz) === needle || normalizeName(r.name_ru) === needle || r.slug === needle;
  const cat = categories.find(eq);
  if (cat) return { category: cat, subcategory: null };
  const sub = subcategories.find(eq);
  if (sub) {
    const parent = categories.find((c) => c.id === sub.category_id);
    if (parent) return { category: parent, subcategory: sub };
  }
  return null;
}
