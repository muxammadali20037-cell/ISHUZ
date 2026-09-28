import type { Enums, Tables } from "@/types/database.types";
import type { WorkerCardData } from "@/components/shared/worker-card";

export type VacancyRow = Tables<"vacancies">;
export type VacancyStatus = Enums<"vacancy_status">;
export type ApplicationStatus = Enums<"application_status">;
export type LanguageLevel = Enums<"language_level">;

export interface NamedRef {
  name_uz: string;
  name_ru: string;
}

export interface VacancySkillItem {
  skill_id: string;
  is_required: boolean;
  name_uz: string;
  name_ru: string;
}

export interface VacancyLanguageItem {
  language_code: string;
  min_level: LanguageLevel;
}

/** Vakansiya + bog'liq ma'lumotnomalar (wizard, boshqarish, preview uchun) */
export interface VacancyFull extends VacancyRow {
  category: (NamedRef & { id: string; slug: string; icon: string | null }) | null;
  subcategory: (NamedRef & { id: string }) | null;
  /** kasblar daraxtidagi aniq kasb */
  profession: (NamedRef & { id: string; name_en: string | null }) | null;
  region: (NamedRef & { id: string }) | null;
  district: (NamedRef & { id: string; lat: number | null; lng: number | null }) | null;
  company: { id: string; name: string; slug: string; logo_url: string | null; verification_status: Enums<"verification_status"> } | null;
  skills: VacancySkillItem[];
  languages: VacancyLanguageItem[];
  benefits: string[];
}

/** Ro'yxat qatori (/employer/vacancies) */
export interface VacancyListItem {
  id: string;
  title: string;
  slug: string;
  status: VacancyStatus;
  salary_from: number | null;
  salary_to: number | null;
  salary_type: Enums<"salary_type">;
  salary_negotiable: boolean;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  views_count: number;
  applications_count: number;
  is_remote: boolean;
  moderation_note: string | null;
  category: NamedRef | null;
  region: NamedRef | null;
  /** can_edit_vacancy bilan bir xil mantiq (egasi yoki owner/admin/recruiter a'zo) */
  can_edit: boolean;
}

export interface ApplicationStats {
  total: number;
  by_status: Partial<Record<ApplicationStatus, number>>;
}

export type MatchingWorker = WorkerCardData;
