import "server-only";

import { cache } from "react";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getBenefits, getCategories, getDistricts, getRegions, getSubcategories } from "@/lib/reference";
import type { SessionContext } from "@/features/auth/session";
import type { MatchReason } from "@/components/shared/match-score";
import type { VacancyCardData } from "@/components/shared/vacancy-card";
import type { Json } from "@/types/database.types";
import { PAGE_SIZE, matchQueryToCategory, toSearchVacanciesArgs, type JobsSearchParams, type SearchVacanciesArgs } from "./search-params";
import type {
  JobsFilterRefs,
  RefItem,
  SavedVacancyItem,
  VacancyDetail,
  VacancySearchRow,
  VacancyViewerState,
  WorkerDashboardStats,
  WorkerHomeContext,
} from "./types";

/** Filtr sheet'lari uchun ma'lumotnoma (so'rov davomida keshlanadi) */
export const getJobsFilterRefs = cache(async (): Promise<JobsFilterRefs> => {
  const [categories, subcategories, regions, districts, benefits] = await Promise.all([
    getCategories(),
    getSubcategories(),
    getRegions(),
    getDistricts(),
    getBenefits("benefit"),
  ]);
  return {
    categories: categories.map((c) => ({ id: c.id, slug: c.slug, name_uz: c.name_uz, name_ru: c.name_ru, icon: c.icon })),
    subcategories: subcategories.map((s) => ({ id: s.id, slug: s.slug, name_uz: s.name_uz, name_ru: s.name_ru, category_id: s.category_id })),
    regions: regions.map((r) => ({ id: r.id, slug: r.slug, name_uz: r.name_uz, name_ru: r.name_ru })),
    districts: districts.map((d) => ({ id: d.id, slug: d.slug, name_uz: d.name_uz, name_ru: d.name_ru, region_id: d.region_id })),
    benefits: benefits.map((b) => ({ code: b.code, name_uz: b.name_uz, name_ru: b.name_ru, kind: b.kind })),
  };
});

/** search_vacancies qatori → VacancyCard ma'lumoti */
export function toCardData(row: VacancySearchRow): VacancyCardData {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    company_name: row.company_name,
    company_logo_url: row.company_logo_url,
    company_verified: row.company_verified,
    region_name_uz: row.region_name_uz,
    region_name_ru: row.region_name_ru,
    district_name_uz: row.district_name_uz,
    district_name_ru: row.district_name_ru,
    is_remote: row.is_remote,
    salary_from: row.salary_from,
    salary_to: row.salary_to,
    salary_type: row.salary_type,
    salary_negotiable: row.salary_negotiable,
    employment_type: row.employment_type,
    schedule: row.schedule,
    work_time_from: row.work_time_from,
    work_time_to: row.work_time_to,
    work_format: row.work_format,
    benefits: row.benefits,
    published_at: row.published_at,
    match_score: row.match_score,
    is_saved: row.is_saved,
    has_applied: row.has_applied,
    is_featured: row.is_featured,
    is_government: row.is_government,
    opportunity_type: row.opportunity_type,
    is_paid: row.is_paid,
  };
}

export interface JobsSearchResult {
  items: VacancyCardData[];
  total: number;
  page: number;
  pageCount: number;
  /** q kategoriya nomiga mos kelib, filtr avtomatik qo'yilgan bo'lsa */
  smart: { category: RefItem; subcategory: RefItem | null } | null;
}

async function resolveSearch(params: JobsSearchParams, limit: number) {
  const refs = await getJobsFilterRefs();
  const explicitCategory = params.category ? (refs.categories.find((c) => c.slug === params.category) ?? null) : null;
  const smart = !explicitCategory && params.q ? matchQueryToCategory(params.q, refs.categories, refs.subcategories) : null;
  const category = explicitCategory ?? smart?.category ?? null;
  const subcategory = category
    ? params.subcategory
      ? (refs.subcategories.find((s) => s.slug === params.subcategory && s.category_id === category.id) ?? null)
      : (smart?.subcategory ?? null)
    : null;
  const region = params.region ? (refs.regions.find((r) => r.slug === params.region) ?? null) : null;
  const args = toSearchVacanciesArgs(params, { categoryId: category?.id, subcategoryId: subcategory?.id, regionId: region?.id }, limit);
  return { args, smart };
}

/** /jobs qidiruvi: slug → id, aqlli kategoriya, RPC */
export async function searchVacancies(params: JobsSearchParams): Promise<JobsSearchResult> {
  const { args, smart } = await resolveSearch(params, PAGE_SIZE);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_vacancies", args);
  if (error) {
    console.error("[jobs] search_vacancies", error.message);
    throw new Error("search_failed");
  }
  const rows = data ?? [];
  const total = Number(rows[0]?.total_count ?? 0);
  return {
    items: rows.map(toCardData),
    total,
    page: params.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    smart: smart ? { category: smart.category, subcategory: smart.subcategory } : null,
  };
}

/** Faqat natijalar soni (bo'sh holatda "filtrni olib tashlasangiz N ta" maslahatlari uchun). Xatoda 0. */
export async function countVacancies(params: JobsSearchParams): Promise<number> {
  const { args } = await resolveSearch({ ...params, page: 1, sort: "newest" }, 1);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_vacancies", args);
  if (error) return 0;
  return Number(data?.[0]?.total_count ?? 0);
}

/** Kichik ro'yxatlar (bosh sahifa bo'limlari, o'xshash vakansiyalar). Xatoda bo'sh ro'yxat. */
export async function searchVacancyCards(args: SearchVacanciesArgs): Promise<VacancyCardData[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_vacancies", args);
  if (error) {
    console.error("[jobs] search_vacancies", error.message);
    return [];
  }
  return (data ?? []).map(toCardData);
}

const VACANCY_DETAIL_SELECT = `*,
  company:companies(id, slug, name, logo_url, about, website, size, verification_status),
  category:categories(id, slug, name_uz, name_ru),
  subcategory:subcategories(id, slug, name_uz, name_ru),
  profession:profession_nodes(id, name_uz, name_ru, name_en),
  region:regions(id, slug, name_uz, name_ru),
  district:districts(id, slug, name_uz, name_ru),
  vacancy_skills(is_required, skill:skills(id, slug, name_uz, name_ru)),
  vacancy_languages(language_code, min_level, language:languages(code, name_uz, name_ru)),
  vacancy_benefits(benefit_code, benefit:benefits(code, name_uz, name_ru, kind))` as const;

/** Slug bo'yicha vakansiya (RLS: faol — hammaga; boshqa holat — faqat boshqaruvchiga). Topilmasa null. */
export const getVacancyBySlug = cache(async (slug: string): Promise<VacancyDetail | null> => {
  if (!/^[a-z0-9-]{3,120}$/i.test(slug)) return null;
  const supabase = await createClient();
  const [{ data, error }, allBenefits] = await Promise.all([
    supabase.from("vacancies").select(VACANCY_DETAIL_SELECT).eq("slug", slug).maybeSingle(),
    getBenefits(),
  ]);
  if (error) {
    console.error("[jobs] getVacancyBySlug", error.message);
    return null;
  }
  if (!data) return null;
  const { vacancy_skills, vacancy_languages, vacancy_benefits, ...vacancy } = data;
  const officialTerms = allBenefits
    .filter((b) => b.kind === "official_term" && vacancy.official_terms.includes(b.code))
    .map((b) => ({ code: b.code, name_uz: b.name_uz, name_ru: b.name_ru, kind: b.kind }));
  return {
    ...vacancy,
    skills: vacancy_skills
      .flatMap((s) => (s.skill ? [{ ...s.skill, is_required: s.is_required }] : []))
      .sort((a, b) => Number(b.is_required) - Number(a.is_required) || a.name_uz.localeCompare(b.name_uz)),
    languages: vacancy_languages.map((l) => ({
      code: l.language_code,
      name_uz: l.language?.name_uz ?? l.language_code,
      name_ru: l.language?.name_ru ?? l.language_code,
      min_level: l.min_level,
    })),
    benefits: vacancy_benefits.flatMap((b) => (b.benefit ? [b.benefit] : [])),
    officialTerms,
  };
});

function parseReasons(json: Json | null | undefined): MatchReason[] {
  if (!Array.isArray(json)) return [];
  const out: MatchReason[] = [];
  for (const r of json) {
    if (r && typeof r === "object" && !Array.isArray(r) && typeof r.key === "string") out.push(r as MatchReason);
  }
  return out;
}

/** Ko'ruvchi holati: boshqaruvchimi, saqlaganmi, ariza yuborganmi, moslik */
export async function getVacancyViewerState(vacancy: VacancyDetail, session: SessionContext | null): Promise<VacancyViewerState> {
  if (!session) return { kind: "guest", isSaved: false, application: null, match: null };
  const supabase = await createClient();
  const workerId = session.workerId && session.workerOnboarded ? session.workerId : null;

  const [managerRes, savedRes, appRes, matchRes] = await Promise.all([
    supabase.rpc("manages_vacancy", { p_vacancy_id: vacancy.id }),
    workerId ? supabase.from("saved_vacancies").select("vacancy_id").eq("worker_id", workerId).eq("vacancy_id", vacancy.id).maybeSingle() : null,
    workerId ? supabase.from("applications").select("id, status").eq("worker_id", workerId).eq("vacancy_id", vacancy.id).maybeSingle() : null,
    workerId ? supabase.rpc("compute_match", { p_worker_id: workerId, p_vacancy_id: vacancy.id }).maybeSingle() : null,
  ]);

  const isManager = managerRes.data === true || vacancy.owner_profile_id === session.userId;
  const kind = isManager ? "manager" : workerId ? "worker" : "no_worker";
  return {
    kind,
    isSaved: !!savedRes?.data,
    application: appRes?.data ? { id: appRes.data.id, status: appRes.data.status } : null,
    match: matchRes?.data && !isManager ? { score: matchRes.data.score, reasons: parseReasons(matchRes.data.reasons) } : null,
  };
}

/** O'xshash vakansiyalar: shu kategoriya, joriysidan tashqari */
export async function getSimilarVacancies(vacancy: VacancyDetail, limit = 5): Promise<VacancyCardData[]> {
  if (!vacancy.category_id) return [];
  const items = await searchVacancyCards({ p_category_id: vacancy.category_id, p_sort: "relevant", p_limit: limit + 1, p_offset: 0 });
  return items.filter((v) => v.id !== vacancy.id).slice(0, limit);
}

const statsSchema = z.object({
  applications: z.coerce.number().default(0),
  active_applications: z.coerce.number().default(0),
  offers: z.coerce.number().default(0),
  profile_views: z.coerce.number().default(0),
  saved: z.coerce.number().default(0),
  completeness: z.coerce.number().default(0),
});

export async function getWorkerDashboardStats(): Promise<WorkerDashboardStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("worker_dashboard_stats");
  if (error) console.error("[jobs] worker_dashboard_stats", error.message);
  const parsed = statsSchema.safeParse(data ?? {});
  return parsed.success ? parsed.data : statsSchema.parse({});
}

/** Bosh sahifa bo'limlari uchun ishchi konteksti: kategoriya, hudud, ish qidiradigan tumanlar */
export async function getWorkerHomeContext(workerId: string): Promise<WorkerHomeContext> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("worker_profiles")
    .select("category_id, region_id, district_id, category:categories(slug), worker_locations(district_id)")
    .eq("id", workerId)
    .maybeSingle();
  if (error) console.error("[jobs] getWorkerHomeContext", error.message);
  const districtIds = new Set<string>();
  if (data?.district_id) districtIds.add(data.district_id);
  for (const l of data?.worker_locations ?? []) districtIds.add(l.district_id);
  return {
    categoryId: data?.category_id ?? null,
    categorySlug: data?.category?.slug ?? null,
    regionId: data?.region_id ?? null,
    districtIds: [...districtIds],
  };
}

/** Saqlangan vakansiyalar (faol bo'lmaganlari RLS tufayli null → "muddati tugagan" karta) */
export async function getSavedVacancies(workerId: string): Promise<SavedVacancyItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_vacancies")
    .select(
      `vacancy_id, created_at,
       vacancy:vacancies(id, slug, title, is_remote, salary_from, salary_to, salary_type, salary_negotiable, employment_type, schedule,
         work_time_from, work_time_to, work_format, published_at, is_featured, status,
         company:companies(name, logo_url, verification_status),
         region:regions(name_uz, name_ru), district:districts(name_uz, name_ru),
         vacancy_benefits(benefit_code))`,
    )
    .eq("worker_id", workerId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[jobs] getSavedVacancies", error.message);
    return [];
  }
  const rows = data ?? [];
  const activeIds = rows.flatMap((r) => (r.vacancy && r.vacancy.status === "active" ? [r.vacancy.id] : []));
  const [matchRes, appRes] = activeIds.length
    ? await Promise.all([
        supabase.from("matches").select("vacancy_id, score").eq("worker_id", workerId).in("vacancy_id", activeIds),
        supabase.from("applications").select("vacancy_id").eq("worker_id", workerId).in("vacancy_id", activeIds),
      ])
    : [null, null];
  const scores = new Map((matchRes?.data ?? []).map((m) => [m.vacancy_id, m.score]));
  const applied = new Set((appRes?.data ?? []).map((a) => a.vacancy_id));

  return rows.map((r) => {
    const v = r.vacancy;
    if (!v || v.status !== "active") return { vacancyId: r.vacancy_id, savedAt: r.created_at, card: null };
    return {
      vacancyId: r.vacancy_id,
      savedAt: r.created_at,
      card: {
        id: v.id,
        slug: v.slug,
        title: v.title,
        company_name: v.company?.name ?? null,
        company_logo_url: v.company?.logo_url ?? null,
        company_verified: v.company?.verification_status === "verified",
        region_name_uz: v.region?.name_uz ?? null,
        region_name_ru: v.region?.name_ru ?? null,
        district_name_uz: v.district?.name_uz ?? null,
        district_name_ru: v.district?.name_ru ?? null,
        is_remote: v.is_remote,
        salary_from: v.salary_from,
        salary_to: v.salary_to,
        salary_type: v.salary_type,
        salary_negotiable: v.salary_negotiable,
        employment_type: v.employment_type,
        schedule: v.schedule,
        work_time_from: v.work_time_from,
        work_time_to: v.work_time_to,
        work_format: v.work_format,
        benefits: v.vacancy_benefits.map((b) => b.benefit_code),
        published_at: v.published_at,
        match_score: scores.get(v.id) ?? null,
        is_saved: true,
        has_applied: applied.has(v.id),
        is_featured: v.is_featured,
      },
    };
  });
}

/** Ko'rishlar sonini oshirish — javob yuborilgandan keyin (after), xato sahifaga ta'sir qilmaydi */
export async function recordVacancyView(vacancyId: string): Promise<void> {
  const supabase = await createClient();
  after(async () => {
    const { error } = await supabase.rpc("record_vacancy_view", { p_vacancy_id: vacancyId });
    if (error) console.error("[jobs] record_vacancy_view", error.message);
  });
}
