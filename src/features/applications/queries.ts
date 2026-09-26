import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database.types";
import {
  parseMatchReasons,
  type ApplicationEvent,
  type ApplicationStatus,
  type CandidateSummary,
  type EmployerApplicationDetail,
  type EmployerApplicationItem,
  type ManagedVacancy,
  type PipelineCounts,
  type PipelineSort,
  type PipelineStatusFilter,
  type ReviewSummary,
  type VacancySummary,
  type WorkerApplicationDetail,
  type WorkerApplicationItem,
} from "./types";

const VACANCY_SELECT =
  "id, title, slug, status, salary_from, salary_to, salary_type, salary_negotiable, owner_profile_id, company_id, company:companies(id, name, slug, logo_url, verification_status)";
const EVENTS_SELECT = "events:application_events(id, from_status, to_status, actor_id, note, created_at)";
const CANDIDATE_SELECT = "worker:worker_profiles(id, profile_id, headline, experience_level, profile:profiles(first_name, last_name, avatar_url))";

type VacancyRow = {
  id: string;
  title: string;
  slug: string;
  status: Enums<"vacancy_status">;
  salary_from: number | null;
  salary_to: number | null;
  salary_type: Enums<"salary_type">;
  salary_negotiable: boolean;
  owner_profile_id: string;
  company_id: string | null;
  company: { id: string; name: string; slug: string; logo_url: string | null; verification_status: Enums<"verification_status"> } | null;
};

type CandidateRow = {
  id: string;
  profile_id: string;
  headline: string | null;
  experience_level: Enums<"experience_level">;
  profile: { first_name: string; last_name: string; avatar_url: string | null } | null;
};

function mapVacancy(v: VacancyRow | null): VacancySummary | null {
  if (!v) return null;
  return {
    id: v.id,
    title: v.title,
    slug: v.slug,
    status: v.status,
    salary_from: v.salary_from,
    salary_to: v.salary_to,
    salary_type: v.salary_type,
    salary_negotiable: v.salary_negotiable,
    owner_profile_id: v.owner_profile_id,
    company_id: v.company_id,
    company: v.company ? { ...v.company } : null,
  };
}

function mapCandidate(w: CandidateRow | null): CandidateSummary | null {
  if (!w) return null;
  return {
    worker_id: w.id,
    profile_id: w.profile_id,
    first_name: w.profile?.first_name ?? "",
    last_initial: w.profile?.last_name ? w.profile.last_name.trim().charAt(0).toUpperCase() : null,
    avatar_url: w.profile?.avatar_url ?? null,
    headline: w.headline,
    experience_level: w.experience_level,
  };
}

function mapEvents(events: ApplicationEvent[] | null | undefined): ApplicationEvent[] {
  return (events ?? []).map((e) => ({ ...e }));
}

async function getMyReview(applicationId: string, userId: string): Promise<ReviewSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("id, rating, text, status, created_at")
    .eq("application_id", applicationId)
    .eq("author_profile_id", userId)
    .maybeSingle();
  if (error) throw new Error(`reviews: ${error.message}`);
  return data ?? null;
}

// =====================================================================
// Ishchi
// =====================================================================

/** Ishchining barcha arizalari (updated_at desc). Vakansiya faol bo'lmasa `vacancy` null keladi (RLS). */
export async function getWorkerApplications(workerId: string): Promise<WorkerApplicationItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .select(`id, status, match_score, created_at, updated_at, vacancy:vacancies(${VACANCY_SELECT})`)
    .eq("worker_id", workerId)
    .order("updated_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(`applications: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    status: row.status,
    match_score: row.match_score,
    created_at: row.created_at,
    updated_at: row.updated_at,
    vacancy: mapVacancy(row.vacancy),
  }));
}

/** Javob kutayotgan takliflar soni (Takliflar tab'i uchun) */
export async function getPendingOffersCount(workerId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase.from("job_offers").select("id", { count: "exact", head: true }).eq("worker_id", workerId).in("status", ["sent", "viewed"]);
  if (error) return 0;
  return count ?? 0;
}

/** Ishchining bitta arizasi (faqat o'ziniki; topilmasa null) */
export async function getWorkerApplication(applicationId: string, workerId: string, userId: string): Promise<WorkerApplicationDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .select(`id, status, match_score, match_reasons, cover_message, viewed_at, created_at, updated_at, vacancy:vacancies(${VACANCY_SELECT}), ${EVENTS_SELECT}`)
    .eq("id", applicationId)
    .eq("worker_id", workerId)
    .maybeSingle();
  if (error) throw new Error(`application: ${error.message}`);
  if (!data) return null;
  const my_review = await getMyReview(applicationId, userId);
  return {
    id: data.id,
    status: data.status,
    match_score: data.match_score,
    match_reasons: parseMatchReasons(data.match_reasons),
    cover_message: data.cover_message,
    viewed_at: data.viewed_at,
    created_at: data.created_at,
    updated_at: data.updated_at,
    vacancy: mapVacancy(data.vacancy),
    events: mapEvents(data.events),
    my_review,
  };
}

// =====================================================================
// Ish beruvchi
// =====================================================================

/**
 * Men boshqaradigan vakansiya (egasi yoki kompaniya a'zosi — rpc manages_vacancy); aks holda null.
 * Faol vakansiyani hamma o'qiy oladi (RLS), shuning uchun boshqaruv huquqi alohida tekshiriladi.
 */
export async function getManagedVacancy(vacancyId: string): Promise<ManagedVacancy | null> {
  const supabase = await createClient();
  const [{ data, error }, manages] = await Promise.all([
    supabase.from("vacancies").select("id, title, slug, status, owner_profile_id, company_id").eq("id", vacancyId).maybeSingle(),
    supabase.rpc("manages_vacancy", { p_vacancy_id: vacancyId }),
  ]);
  if (error) throw new Error(`vacancy: ${error.message}`);
  if (!data || manages.error || manages.data !== true) return null;
  return data;
}

/** Holatni o'zgartirish huquqi: egasi yoki owner/admin/recruiter a'zo (viewer faqat ko'radi) */
export async function canEditVacancy(vacancyId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("can_edit_vacancy", { p_vacancy_id: vacancyId });
  if (error) return false;
  return data === true;
}

/** Holatlar bo'yicha sonlar (filtr chiplari uchun) */
export async function getPipelineCounts(vacancyId: string): Promise<PipelineCounts> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("applications").select("status").eq("vacancy_id", vacancyId);
  if (error) throw new Error(`applications: ${error.message}`);
  const counts: PipelineCounts = { all: 0, sent: 0, viewed: 0, shortlisted: 0, interview: 0, offered: 0, hired: 0, rejected: 0, withdrawn: 0 };
  for (const row of data ?? []) {
    counts.all += 1;
    counts[row.status] += 1;
  }
  return counts;
}

/** Vakansiya arizalari (filtr + saralash). Nomzod profili yopiq bo'lsa `candidate` null. */
export async function getVacancyApplications(vacancyId: string, opts: { status: PipelineStatusFilter; sort: PipelineSort }): Promise<EmployerApplicationItem[]> {
  const supabase = await createClient();
  let q = supabase.from("applications").select(`id, vacancy_id, status, match_score, cover_message, created_at, updated_at, ${CANDIDATE_SELECT}`).eq("vacancy_id", vacancyId);
  if (opts.status !== "all") q = q.eq("status", opts.status);
  q = opts.sort === "match" ? q.order("match_score", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }) : q.order("created_at", { ascending: false });
  const { data, error } = await q.limit(300);
  if (error) throw new Error(`applications: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    vacancy_id: row.vacancy_id,
    status: row.status,
    match_score: row.match_score,
    cover_message: row.cover_message,
    created_at: row.created_at,
    updated_at: row.updated_at,
    candidate: mapCandidate(row.worker),
  }));
}

/** Ish beruvchi uchun ariza tafsiloti (RLS: faqat vakansiya boshqaruvchisi yoki nomzodning o'zi ko'radi) */
export async function getEmployerApplication(applicationId: string, userId: string): Promise<EmployerApplicationDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .select(`id, vacancy_id, status, match_score, match_reasons, cover_message, viewed_at, created_at, updated_at, vacancy:vacancies(id, title, slug, status), ${CANDIDATE_SELECT}, ${EVENTS_SELECT}`)
    .eq("id", applicationId)
    .maybeSingle();
  if (error) throw new Error(`application: ${error.message}`);
  if (!data) return null;
  const my_review = await getMyReview(applicationId, userId);
  return {
    id: data.id,
    vacancy_id: data.vacancy_id,
    status: data.status,
    match_score: data.match_score,
    match_reasons: parseMatchReasons(data.match_reasons),
    cover_message: data.cover_message,
    viewed_at: data.viewed_at,
    created_at: data.created_at,
    updated_at: data.updated_at,
    candidate: mapCandidate(data.worker),
    events: mapEvents(data.events),
    my_review,
    vacancy: data.vacancy ? { id: data.vacancy.id, title: data.vacancy.title, slug: data.vacancy.slug, status: data.vacancy.status } : null,
  };
}

/**
 * Ish beruvchi arizani birinchi marta ochganda: sent → viewed (RPC idempotent: faqat `sent` bo'lsa o'zgaradi).
 * Sahifa render'ida chaqiriladi, shuning uchun revalidatePath ishlatilmaydi. Muvaffaqiyat bo'lsa true.
 */
export async function markApplicationViewedOnOpen(applicationId: string, currentStatus: ApplicationStatus): Promise<boolean> {
  if (currentStatus !== "sent") return false;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_application_status", { p_application_id: applicationId, p_status: "viewed" });
  if (error) {
    console.error("[applications] mark viewed", error.message);
    return false;
  }
  return true;
}
