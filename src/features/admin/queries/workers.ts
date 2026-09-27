import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database.types";
import { PAGE_SIZE, likeTerm, isUuid, oneOf, pageRange, parsePage, param, toPaged, type Paged, type SearchParams } from "./shared";

export interface WorkerFilters {
  q: string;
  status: Enums<"worker_status"> | undefined;
  category: string;
  region: string;
  cmin: number | undefined;
  cmax: number | undefined;
  page: number;
}

function intOrUndefined(v: string): number | undefined {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : undefined;
}

export function parseWorkerFilters(sp: SearchParams): WorkerFilters {
  const category = param(sp, "category");
  const region = param(sp, "region");
  return {
    q: param(sp, "q"),
    status: oneOf(param(sp, "status"), ["active", "open", "not_looking"] as const),
    category: isUuid(category) ? category : "",
    region: isUuid(region) ? region : "",
    cmin: intOrUndefined(param(sp, "cmin")),
    cmax: intOrUndefined(param(sp, "cmax")),
    page: parsePage(sp),
  };
}

const LIST_SELECT =
  "id, profile_id, headline, status, completeness, is_public, onboarding_completed_at, experience_level, last_active_at, created_at, views_count, profiles!worker_profiles_profile_id_fkey!inner(first_name, last_name, avatar_url, is_blocked), categories(name_uz, name_ru), regions(name_uz, name_ru)" as const;

export type WorkerRow = {
  id: string;
  profile_id: string;
  headline: string | null;
  status: Enums<"worker_status">;
  completeness: number;
  is_public: boolean;
  onboarding_completed_at: string | null;
  experience_level: Enums<"experience_level">;
  last_active_at: string;
  created_at: string;
  views_count: number;
  profiles: { first_name: string; last_name: string; avatar_url: string | null; is_blocked: boolean };
  categories: { name_uz: string; name_ru: string } | null;
  regions: { name_uz: string; name_ru: string } | null;
};

/** Ishchi profillari (workers.view; RLS: admin hammasini ko'radi) */
export async function listWorkers(f: WorkerFilters): Promise<Paged<WorkerRow> & { error: string | null }> {
  const supabase = await createClient();
  const [from, to] = pageRange(f.page);

  let q = supabase.from("worker_profiles").select(LIST_SELECT, { count: "exact" }).order("last_active_at", { ascending: false }).range(from, to);
  if (f.status) q = q.eq("status", f.status);
  if (f.category) q = q.eq("category_id", f.category);
  if (f.region) q = q.eq("region_id", f.region);
  if (f.cmin !== undefined) q = q.gte("completeness", f.cmin);
  if (f.cmax !== undefined) q = q.lte("completeness", f.cmax);
  if (f.q) {
    if (isUuid(f.q)) {
      q = q.or(`id.eq.${f.q},profile_id.eq.${f.q}`);
    } else {
      // Ism bo'yicha mos profillar (ikki bosqich: PostgREST or() boshqa jadval ustunini qabul qilmaydi)
      const { data: byName } = await supabase.from("profiles").select("id").or(`first_name.ilike.${likeTerm(f.q)},last_name.ilike.${likeTerm(f.q)}`).limit(200);
      const ids = (byName ?? []).map((r) => r.id);
      q = ids.length ? q.or(`headline.ilike.${likeTerm(f.q)},profile_id.in.(${ids.join(",")})`) : q.ilike("headline", likeTerm(f.q));
    }
  }
  const { data, count, error } = await q;
  return { ...toPaged<WorkerRow>(data ?? [], count, f.page, PAGE_SIZE), error: error?.message ?? null };
}

/** Bitta ishchi: ko'nikmalar, tillar, istaklar, tajriba */
export async function getWorkerDetail(id: string) {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("worker_profiles")
    .select(
      `${LIST_SELECT}, about, work_format, remote_preference, area_hint, subcategories(name_uz, name_ru), districts(name_uz, name_ru),
       worker_skills(level, skills(name_uz, name_ru)),
       worker_languages(level, languages(name_uz, name_ru)),
       worker_preferences(employment_types, schedules, salary_min, salary_expected, salary_type, availability, official_terms),
       worker_experience(company_name, position, started_on, ended_on, is_current),
       worker_education(level, institution, field)`,
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

export type WorkerDetail = NonNullable<Awaited<ReturnType<typeof getWorkerDetail>>>;
