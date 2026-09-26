import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/utils";
import type { Enums } from "@/types/database.types";
import type { WorkerCardData } from "@/components/shared/worker-card";
import type { VacancyCardData } from "@/components/shared/vacancy-card";
import { parseDashboardStats, toVacancyCardData, toWorkerCardData } from "./mappers";
import type {
  CompanyInviteRow,
  CompanyMemberRole,
  CompanyPublic,
  CompanyRow,
  DashboardStats,
  EmployerProfileRow,
  MemberRow,
  MyVacancyRow,
  ProfileRating,
  RecentApplicationRow,
  VerificationRequestRow,
} from "./types";

/** Ish beruvchi moduli: server tomonida o'qish (RLS foydalanuvchi nomidan). Xatolarda bo'sh natija + console.error. */

export const getEmployerProfile = cache(async (userId: string): Promise<EmployerProfileRow | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("employer_profiles").select("*").eq("profile_id", userId).maybeSingle();
  if (error) console.error("[employer] getEmployerProfile", error.message);
  return data ?? null;
});

export const getCompanyById = cache(async (companyId: string): Promise<CompanyRow | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("companies").select("*").eq("id", companyId).maybeSingle();
  if (error) console.error("[employer] getCompanyById", error.message);
  return data ?? null;
});

export const getMyCompanyRole = cache(async (companyId: string, userId: string): Promise<CompanyMemberRole | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("company_members").select("role").eq("company_id", companyId).eq("profile_id", userId).maybeSingle();
  if (error) console.error("[employer] getMyCompanyRole", error.message);
  return data?.role ?? null;
});

export async function getDashboardStats(): Promise<DashboardStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("employer_dashboard_stats");
  if (error) {
    console.error("[employer] employer_dashboard_stats", error.message);
    return null;
  }
  return parseDashboardStats(data);
}

/** Mening vakansiyalarim filtri: egasi yoki kompaniya (RLS faol vakansiyalarni hammaga ochadi, shuning uchun aniq filtr) */
function mineFilter(userId: string, companyId: string | null): string {
  return companyId ? `owner_profile_id.eq.${userId},company_id.eq.${companyId}` : `owner_profile_id.eq.${userId}`;
}

const MY_VACANCY_COLUMNS = "id, title, status, applications_count, views_count, updated_at, published_at, category_id, region_id";

export async function getMyVacancies(userId: string, companyId: string | null, limit = 5): Promise<MyVacancyRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("vacancies").select(MY_VACANCY_COLUMNS).or(mineFilter(userId, companyId)).order("updated_at", { ascending: false }).limit(limit);
  if (error) {
    console.error("[employer] getMyVacancies", error.message);
    return [];
  }
  return data ?? [];
}

/** Eng so'nggi vakansiyam (faol yoki istalgan holatda) — tavsiyalar uchun */
export const getLatestVacancy = cache(async (userId: string, companyId: string | null, activeOnly: boolean): Promise<MyVacancyRow | null> => {
  const supabase = await createClient();
  let q = supabase.from("vacancies").select(MY_VACANCY_COLUMNS).or(mineFilter(userId, companyId));
  if (activeOnly) q = q.eq("status", "active").order("published_at", { ascending: false, nullsFirst: false });
  else q = q.order("updated_at", { ascending: false });
  const { data, error } = await q.limit(1).maybeSingle();
  if (error) console.error("[employer] getLatestVacancy", error.message);
  return data ?? null;
});

export async function getRecentApplications(userId: string, companyId: string | null, limit = 5): Promise<RecentApplicationRow[]> {
  const supabase = await createClient();
  const { data: mine, error: vErr } = await supabase.from("vacancies").select("id").or(mineFilter(userId, companyId)).limit(200);
  if (vErr) {
    console.error("[employer] getRecentApplications(vacancies)", vErr.message);
    return [];
  }
  const ids = (mine ?? []).map((v) => v.id);
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("applications")
    .select("id, status, match_score, created_at, vacancy_id, vacancies!inner(title), worker_profiles(profiles!worker_profiles_profile_id_fkey(first_name, last_name, avatar_url))")
    .in("vacancy_id", ids)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[employer] getRecentApplications", error.message);
    return [];
  }
  return (data ?? []).map((a) => {
    const profile = a.worker_profiles?.profiles ?? null;
    return {
      id: a.id,
      status: a.status,
      match_score: a.match_score,
      created_at: a.created_at,
      vacancy_id: a.vacancy_id,
      vacancy_title: a.vacancies?.title ?? "",
      first_name: profile?.first_name ?? null,
      last_name: profile?.last_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
    };
  });
}

export interface CandidateSearch {
  vacancyId?: string | null;
  categoryId?: string | null;
  regionId?: string | null;
  statuses?: Enums<"worker_status">[];
  availability?: Enums<"availability">[];
  sort?: "relevant" | "newest" | "distance";
  limit?: number;
}

/** search_workers RPC → WorkerCard ro'yxati (xatoda bo'sh) */
export async function searchCandidates(params: CandidateSearch): Promise<WorkerCardData[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_workers", {
    p_vacancy_id: params.vacancyId ?? undefined,
    p_category_id: params.categoryId ?? undefined,
    p_region_id: params.regionId ?? undefined,
    p_statuses: params.statuses,
    p_availability: params.availability,
    p_sort: params.sort ?? "relevant",
    p_limit: params.limit ?? 6,
    p_offset: 0,
  });
  if (error) {
    console.error("[employer] search_workers", errorCode(error), error.message);
    return [];
  }
  return (data ?? []).map(toWorkerCardData);
}

// ---------- ochiq kompaniya sahifasi ----------

export const getCompanyBySlug = cache(async (slug: string): Promise<CompanyPublic | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*, region:regions(name_uz, name_ru), district:districts(name_uz, name_ru), industry:categories(name_uz, name_ru, slug, icon)")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("[employer] getCompanyBySlug", error.message);
    return null;
  }
  return data ?? null;
});

export async function getCompanyVacancies(companyId: string, limit = 20): Promise<VacancyCardData[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_vacancies", { p_company_id: companyId, p_sort: "newest", p_limit: limit, p_offset: 0 });
  if (error) {
    console.error("[employer] search_vacancies(company)", error.message);
    return [];
  }
  return (data ?? []).map(toVacancyCardData);
}

export async function getProfileRating(profileId: string): Promise<ProfileRating | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("profile_rating", { p_profile_id: profileId }).maybeSingle();
  if (error) {
    console.error("[employer] profile_rating", error.message);
    return null;
  }
  if (!data || !Number(data.reviews_count)) return null;
  return { avg_rating: Number(data.avg_rating ?? 0), reviews_count: Number(data.reviews_count) };
}

// ---------- sozlamalar ----------

export async function getCompanyMembers(companyId: string): Promise<MemberRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_members")
    .select("profile_id, role, created_at, profile:profiles!company_members_profile_id_fkey(first_name, last_name, avatar_url)")
    .eq("company_id", companyId)
    .order("created_at");
  if (error) {
    console.error("[employer] getCompanyMembers", error.message);
    return [];
  }
  const order: Record<CompanyMemberRole, number> = { owner: 0, admin: 1, recruiter: 2, viewer: 3 };
  return (data ?? [])
    .map((m) => ({
      profile_id: m.profile_id,
      role: m.role,
      created_at: m.created_at,
      first_name: m.profile?.first_name ?? null,
      last_name: m.profile?.last_name ?? null,
      avatar_url: m.profile?.avatar_url ?? null,
    }))
    .sort((a, b) => order[a.role] - order[b.role] || a.created_at.localeCompare(b.created_at));
}

/** Kutilayotgan (qabul qilinmagan, muddati o'tmagan) takliflar — faqat adminlar ko'radi (RLS) */
export async function getPendingInvites(companyId: string): Promise<CompanyInviteRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_invites")
    .select("id, role, token, expires_at, created_at")
    .eq("company_id", companyId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[employer] getPendingInvites", error.message);
    return [];
  }
  return data ?? [];
}

export async function getVerificationRequests(userId: string, companyId: string | null): Promise<VerificationRequestRow[]> {
  const supabase = await createClient();
  let q = supabase.from("verification_requests").select("*").eq("profile_id", userId).order("created_at", { ascending: false }).limit(20);
  q = companyId ? q.eq("company_id", companyId) : q.is("company_id", null);
  const { data, error } = await q;
  if (error) {
    console.error("[employer] getVerificationRequests", error.message);
    return [];
  }
  return data ?? [];
}
