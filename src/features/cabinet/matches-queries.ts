import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SessionContext } from "@/features/auth/session";
import type { MatchReason } from "@/components/shared/match-score";

type Named = { name_uz: string; name_ru: string; name_en: string | null; name_oz?: string | null };

export interface JobMatch {
  vacancyId: string;
  slug: string;
  title: string;
  employer: string | null;
  region: Named | null;
  district: Named | null;
  salaryFrom: number | null;
  salaryTo: number | null;
  negotiable: boolean;
  score: number;
  hardFail: boolean;
  complete: boolean;
  reasons: MatchReason[];
}

export interface CandidateMatch {
  workerId: string;
  name: string;
  headline: string | null;
  profession: Named | null;
  region: Named | null;
  district: Named | null;
  experience: string | null;
  score: number;
  hardFail: boolean;
  complete: boolean;
  reasons: MatchReason[];
}

/** Ishchi uchun: o'z e'loniga mos faol vakansiyalar (hisoblangan moslik, sabablar bilan) */
export async function getJobMatches(session: SessionContext): Promise<JobMatch[]> {
  if (!session.workerId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matches")
    .select("score, reasons, hard_fail, complete, vacancies!inner(id, slug, title, status, salary_from, salary_to, salary_negotiable, companies(name), regions!vacancies_region_id_fkey(name_uz, name_ru, name_en, name_oz), districts!vacancies_district_id_fkey(name_uz, name_ru, name_en, name_oz))")
    .eq("worker_id", session.workerId)
    .eq("vacancies.status", "active")
    .order("hard_fail", { ascending: true })
    .order("score", { ascending: false })
    .limit(40);
  if (error) console.error("[matches] jobs", error.message);
  return (data ?? []).map((m) => ({
    vacancyId: m.vacancies.id,
    slug: m.vacancies.slug,
    title: m.vacancies.title,
    employer: m.vacancies.companies?.name ?? null,
    region: m.vacancies.regions,
    district: m.vacancies.districts,
    salaryFrom: m.vacancies.salary_from,
    salaryTo: m.vacancies.salary_to,
    negotiable: m.vacancies.salary_negotiable,
    score: m.score,
    hardFail: m.hard_fail,
    complete: m.complete,
    reasons: (Array.isArray(m.reasons) ? m.reasons : []) as unknown as MatchReason[],
  }));
}

/** Ish beruvchi uchun: vakansiyaga mos ochiq nomzodlar */
export async function getCandidateMatches(vacancyId: string): Promise<CandidateMatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matches")
    .select("score, reasons, hard_fail, complete, worker_profiles!inner(id, headline, experience_level, is_public, profiles!worker_profiles_profile_id_fkey(first_name, last_name), profession_nodes(name_uz, name_ru, name_en), regions!worker_profiles_region_id_fkey(name_uz, name_ru, name_en, name_oz), districts!worker_profiles_district_id_fkey(name_uz, name_ru, name_en, name_oz))")
    .eq("vacancy_id", vacancyId)
    .eq("worker_profiles.is_public", true)
    .order("hard_fail", { ascending: true })
    .order("score", { ascending: false })
    .limit(50);
  if (error) console.error("[matches] candidates", error.message);
  return (data ?? []).map((m) => {
    const w = m.worker_profiles;
    const initial = (w.profiles?.last_name ?? "").slice(0, 1);
    return {
      workerId: w.id,
      name: [w.profiles?.first_name ?? "", initial ? `${initial}.` : ""].filter(Boolean).join(" "),
      headline: w.headline,
      profession: w.profession_nodes,
      region: w.regions,
      district: w.districts,
      experience: w.experience_level,
      score: m.score,
      hardFail: m.hard_fail,
      complete: m.complete,
      reasons: (Array.isArray(m.reasons) ? m.reasons : []) as unknown as MatchReason[],
    };
  });
}

export async function getMyActiveVacancies(session: SessionContext): Promise<{ id: string; title: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vacancies")
    .select("id, title")
    .eq("owner_profile_id", session.userId)
    .eq("status", "active")
    .order("published_at", { ascending: false })
    .limit(30);
  return data ?? [];
}

export async function getMatchThreshold(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", "match_notify_threshold").maybeSingle();
  const n = Number(data?.value ?? 90);
  return Number.isFinite(n) ? n : 90;
}
