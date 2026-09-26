import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database.types";
import { PAGE_SIZE, likeTerm, isUuid, oneOf, pageRange, parsePage, param, toPaged, type Paged, type SearchParams } from "./shared";

export const VACANCY_STATUSES = ["pending_review", "active", "paused", "closed", "expired", "hidden", "rejected", "draft"] as const;

export interface VacancyFilters {
  status: Enums<"vacancy_status"> | undefined;
  category: string;
  q: string;
  page: number;
}

export function parseVacancyFilters(sp: SearchParams): VacancyFilters {
  const category = param(sp, "category");
  return {
    status: oneOf(param(sp, "status"), VACANCY_STATUSES),
    category: isUuid(category) ? category : "",
    q: param(sp, "q"),
    page: parsePage(sp),
  };
}

const LIST_SELECT =
  "id, title, slug, status, requires_review, published_at, created_at, expires_at, applications_count, views_count, moderation_note, salary_from, salary_to, salary_type, salary_negotiable, owner_profile_id, company_id, companies(name, slug, verification_status), profiles!vacancies_owner_profile_id_fkey(first_name, last_name, is_blocked), categories(name_uz, name_ru), regions(name_uz, name_ru)" as const;

export type VacancyRow = {
  id: string;
  title: string;
  slug: string;
  status: Enums<"vacancy_status">;
  requires_review: boolean;
  published_at: string | null;
  created_at: string;
  expires_at: string | null;
  applications_count: number;
  views_count: number;
  moderation_note: string | null;
  salary_from: number | null;
  salary_to: number | null;
  salary_type: Enums<"salary_type">;
  salary_negotiable: boolean;
  owner_profile_id: string | null;
  company_id: string | null;
  companies: { name: string; slug: string; verification_status: Enums<"verification_status"> } | null;
  profiles: { first_name: string; last_name: string; is_blocked: boolean } | null;
  categories: { name_uz: string; name_ru: string } | null;
  regions: { name_uz: string; name_ru: string } | null;
  reports_count: number;
};

/** Barcha vakansiyalar (RLS: vacancies.view) + har biriga shikoyatlar soni */
export async function listVacancies(f: VacancyFilters): Promise<Paged<VacancyRow> & { error: string | null }> {
  const supabase = await createClient();
  const [from, to] = pageRange(f.page);
  let q = supabase.from("vacancies").select(LIST_SELECT, { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  if (f.status) q = q.eq("status", f.status);
  if (f.category) q = q.eq("category_id", f.category);
  if (f.q) {
    if (isUuid(f.q)) q = q.or(`id.eq.${f.q},owner_profile_id.eq.${f.q},company_id.eq.${f.q}`);
    else q = q.or(`title.ilike.${likeTerm(f.q)},slug.ilike.${likeTerm(f.q)}`);
  }
  const { data, count, error } = await q;
  const base = data ?? [];
  const ids = base.map((v) => v.id);
  const reportCounts = new Map<string, number>();
  if (ids.length) {
    const { data: reps } = await supabase.from("reports").select("target_id").eq("target_type", "vacancy").in("target_id", ids);
    for (const r of reps ?? []) reportCounts.set(r.target_id, (reportCounts.get(r.target_id) ?? 0) + 1);
  }
  const rows: VacancyRow[] = base.map((v) => ({ ...v, reports_count: reportCounts.get(v.id) ?? 0 }));
  return { ...toPaged(rows, count, f.page, PAGE_SIZE), error: error?.message ?? null };
}

/** Preview uchun to'liq vakansiya (tavsif, talablar) */
export async function getVacancyDetail(id: string) {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("vacancies")
    .select(
      `${LIST_SELECT}, description, address, is_remote, employment_type, schedule, work_time_from, work_time_to, experience_min_months, age_min, age_max, education_min, gender, work_format, official_terms, updated_at,
       districts(name_uz, name_ru), subcategories(name_uz, name_ru), vacancy_skills(is_required, skills(name_uz, name_ru)), vacancy_languages(min_level, languages(name_uz, name_ru)), vacancy_benefits(benefits(name_uz, name_ru))`,
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

export type VacancyDetail = NonNullable<Awaited<ReturnType<typeof getVacancyDetail>>>;

/** Status bo'yicha sonlar (tab badge'lari) */
export async function vacancyStatusCounts(): Promise<Partial<Record<Enums<"vacancy_status">, number>>> {
  const supabase = await createClient();
  const results = await Promise.all(VACANCY_STATUSES.map((s) => supabase.from("vacancies").select("id", { count: "exact", head: true }).eq("status", s)));
  const out: Partial<Record<Enums<"vacancy_status">, number>> = {};
  VACANCY_STATUSES.forEach((s, i) => {
    out[s] = results[i]?.count ?? 0;
  });
  return out;
}
