import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { SessionContext } from "@/features/auth/session";
import type { Json } from "@/types/database.types";
import type { WorkerCardData } from "@/components/shared/worker-card";
import type { ApplicationStats, ApplicationStatus, VacancyFull, VacancyListItem } from "./types";

/** can_edit_vacancy bilan bir xil: egasi yoki owner/admin/recruiter rolidagi kompaniya a'zosi */
const EDIT_ROLES: ReadonlySet<string> = new Set(["owner", "admin", "recruiter"]);

/** Mening kompaniya a'zoliklarim (company_id → rol). RLS: o'z qatorlarimni ko'raman. */
const myCompanyRoles = cache(async (userId: string): Promise<Map<string, string>> => {
  const supabase = await createClient();
  const { data } = await supabase.from("company_members").select("company_id, role").eq("profile_id", userId);
  return new Map((data ?? []).map((m) => [m.company_id, m.role]));
});

const LIST_SELECT =
  "id, title, slug, status, salary_from, salary_to, salary_type, salary_negotiable, published_at, expires_at, created_at, updated_at, views_count, applications_count, is_remote, moderation_note, owner_profile_id, company_id, category:categories(name_uz, name_ru), region:regions(name_uz, name_ru)";

/**
 * Mening vakansiyalarim: egasi menman yoki men a'zo bo'lgan kompaniyaniki.
 * (RLS active vakansiyalarni hammaga ko'rsatadi — shuning uchun filtr aniq yoziladi.)
 */
export async function getMyVacancies(session: SessionContext): Promise<VacancyListItem[]> {
  const supabase = await createClient();
  const roles = await myCompanyRoles(session.userId);
  const companyIds = [...roles.keys()];
  let q = supabase.from("vacancies").select(LIST_SELECT).order("updated_at", { ascending: false }).limit(500);
  q = companyIds.length ? q.or(`owner_profile_id.eq.${session.userId},company_id.in.(${companyIds.join(",")})`) : q.eq("owner_profile_id", session.userId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((v) => ({
    id: v.id,
    title: v.title,
    slug: v.slug,
    status: v.status,
    salary_from: v.salary_from,
    salary_to: v.salary_to,
    salary_type: v.salary_type,
    salary_negotiable: v.salary_negotiable,
    published_at: v.published_at,
    expires_at: v.expires_at,
    created_at: v.created_at,
    updated_at: v.updated_at,
    views_count: v.views_count,
    applications_count: v.applications_count,
    is_remote: v.is_remote,
    moderation_note: v.moderation_note,
    category: v.category,
    region: v.region,
    can_edit: v.owner_profile_id === session.userId || (!!v.company_id && EDIT_ROLES.has(roles.get(v.company_id) ?? "")),
  }));
}

const FULL_SELECT =
  "*, category:categories(id, slug, name_uz, name_ru, icon), subcategory:subcategories(id, name_uz, name_ru), region:regions(id, name_uz, name_ru), district:districts(id, name_uz, name_ru, lat, lng), company:companies(id, name, slug, logo_url, verification_status), vacancy_skills(skill_id, is_required, skill:skills(id, name_uz, name_ru)), vacancy_languages(language_code, min_level), vacancy_benefits(benefit_code)";

/** Vakansiya + bog'liq yozuvlar. RLS: menga ko'rinmasa null. */
export const getVacancyFull = cache(async (id: string): Promise<VacancyFull | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("vacancies").select(FULL_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const { vacancy_skills, vacancy_languages, vacancy_benefits, ...row } = data;
  return {
    ...row,
    skills: vacancy_skills.flatMap((s) => (s.skill ? [{ skill_id: s.skill_id, is_required: s.is_required, name_uz: s.skill.name_uz, name_ru: s.skill.name_ru }] : [])),
    languages: vacancy_languages.map((l) => ({ language_code: l.language_code, min_level: l.min_level })),
    benefits: vacancy_benefits.map((b) => b.benefit_code),
  };
});

export interface VacancyAccess {
  canView: boolean;
  canEdit: boolean;
}

/** manages_vacancy = ko'rish (viewer ham), can_edit_vacancy = tahrirlash (owner/admin/recruiter) */
export const getVacancyAccess = cache(async (id: string): Promise<VacancyAccess> => {
  const supabase = await createClient();
  const [view, edit] = await Promise.all([supabase.rpc("manages_vacancy", { p_vacancy_id: id }), supabase.rpc("can_edit_vacancy", { p_vacancy_id: id })]);
  return { canView: view.data === true, canEdit: edit.data === true };
});

/** Boshqaruv sahifalari uchun: ko'rish huquqi bo'lmasa null (→ notFound) */
export async function getVacancyForManager(id: string): Promise<{ vacancy: VacancyFull; access: VacancyAccess } | null> {
  const [vacancy, access] = await Promise.all([getVacancyFull(id), getVacancyAccess(id)]);
  if (!vacancy || !access.canView) return null;
  return { vacancy, access };
}

/** Arizalar holat bo'yicha (RLS: faqat menejer ko'radi) */
export async function getApplicationStats(vacancyId: string): Promise<ApplicationStats> {
  const supabase = await createClient();
  const { data } = await supabase.from("applications").select("status").eq("vacancy_id", vacancyId).limit(5000);
  const by_status: Partial<Record<ApplicationStatus, number>> = {};
  for (const row of data ?? []) by_status[row.status] = (by_status[row.status] ?? 0) + 1;
  return { total: data?.length ?? 0, by_status };
}

function jsonArray<T>(value: Json | null | undefined): T[] | null {
  return Array.isArray(value) ? (value as unknown as T[]) : null;
}

/** Vakansiyaga mos nomzodlar: search_workers(p_vacancy_id, p_category_id, 'relevant') */
export async function getMatchingWorkers(vacancyId: string, categoryId: string | null, limit = 10): Promise<WorkerCardData[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_workers", {
    p_vacancy_id: vacancyId,
    p_category_id: categoryId ?? undefined,
    p_sort: "relevant",
    p_limit: limit,
  });
  if (error) {
    console.error("[vacancies] search_workers", error.message);
    return [];
  }
  return (data ?? []).map((w) => ({
    id: w.id,
    first_name: w.first_name,
    last_initial: w.last_initial,
    avatar_url: w.avatar_url,
    headline: w.headline,
    category_name_uz: w.category_name_uz,
    category_name_ru: w.category_name_ru,
    region_name_uz: w.region_name_uz,
    region_name_ru: w.region_name_ru,
    district_name_uz: w.district_name_uz,
    district_name_ru: w.district_name_ru,
    experience_level: w.experience_level,
    status: w.status,
    salary_min: w.salary_min,
    salary_expected: w.salary_expected,
    employment_types: w.employment_types,
    skills: jsonArray<{ id: string; name_uz: string; name_ru: string; level: string }>(w.skills),
    languages: jsonArray<{ code: string; level: string }>(w.languages),
    has_portfolio: w.has_portfolio,
    phone_verified: w.phone_verified,
    match_score: w.match_score,
    distance_km: w.distance_km,
    is_saved: w.is_saved,
  }));
}
