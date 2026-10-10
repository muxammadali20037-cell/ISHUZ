import type { Database, Enums, Tables } from "@/types/database.types";

export type EmployerProfileRow = Tables<"employer_profiles">;
export type CompanyRow = Tables<"companies">;
export type VerificationRequestRow = Tables<"verification_requests">;
export type CompanyMemberRole = Enums<"company_member_role">;
export type VerificationStatus = Enums<"verification_status">;
export type VerificationType = Enums<"verification_type">;

export type SearchWorkerRow = Database["public"]["Functions"]["search_workers"]["Returns"][number];
export type SearchVacancyRow = Database["public"]["Functions"]["search_vacancies"]["Returns"][number];

/** employer_dashboard_stats() natijasi */
export interface DashboardStats {
  active_vacancies: number;
  total_vacancies: number;
  applications: number;
  new_applications: number;
  views: number;
  saved_workers: number;
  offers_sent: number;
  hired: number;
}

export type MyVacancyRow = Pick<Tables<"vacancies">, "id" | "title" | "status" | "applications_count" | "views_count" | "updated_at" | "published_at" | "category_id" | "region_id">;

export interface RecentApplicationRow {
  id: string;
  status: Enums<"application_status">;
  match_score: number | null;
  created_at: string;
  vacancy_id: string;
  vacancy_title: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export interface NamedRef {
  name_uz: string;
  name_ru: string;
}

/** Ochiq sahifa: STIR (tin) anon uchun ochiq emas (0056 ustun huquqlari) */
export interface CompanyPublic extends Omit<CompanyRow, "tin"> {
  region: NamedRef | null;
  district: NamedRef | null;
  industry: (NamedRef & { slug: string; icon: string | null }) | null;
}

export interface MemberRow {
  profile_id: string;
  role: CompanyMemberRole;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export interface ProfileRating {
  avg_rating: number;
  reviews_count: number;
}

export interface EmployerDisplay {
  name: string;
  logoUrl: string | null;
  verificationStatus: VerificationStatus;
  companyId: string | null;
  companySlug: string | null;
  regionId: string | null;
}

export type CompanyInviteRow = Pick<Tables<"company_invites">, "id" | "role" | "token" | "expires_at" | "created_at">;
