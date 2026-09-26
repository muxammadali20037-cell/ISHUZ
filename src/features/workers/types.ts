import type { Enums } from "@/types/database.types";
import type { WorkerCardData } from "@/components/shared/worker-card";
import type { MatchReason } from "@/components/shared/match-score";

export type NamedRow = { name_uz: string; name_ru: string };

/** Ish beruvchining o'z vakansiyasi (banner, taklif, moslik tanlovi uchun) */
export interface MyVacancy {
  id: string;
  title: string;
  status: Enums<"vacancy_status">;
  salary_from: number | null;
  salary_to: number | null;
  salary_type: Enums<"salary_type">;
  salary_negotiable: boolean;
  lat: number | null;
  lng: number | null;
  published_at: string | null;
  created_at: string;
}

/** Masofa hisoblash nuqtasi: URL'dagi koordinata yoki vakansiya manzili */
export interface DistanceOrigin {
  lat: number;
  lng: number;
  source: "me" | "vacancy";
}

export interface WorkerSearchResult {
  rows: WorkerCardData[];
  total: number;
  error: string | null;
}

export interface SkillOption {
  id: string;
  name_uz: string;
  name_ru: string;
  category_id: string | null;
}

export interface CandidateSkill {
  id: string;
  name_uz: string;
  name_ru: string;
  level: Enums<"skill_level">;
}

export interface CandidateLanguage {
  code: string;
  level: Enums<"language_level">;
}

export interface CandidateExperience {
  id: string;
  company_name: string;
  position: string;
  started_on: string;
  ended_on: string | null;
  is_current: boolean;
  responsibilities: string | null;
  achievements: string | null;
}

export interface CandidateEducation {
  id: string;
  level: Enums<"education_level">;
  institution: string | null;
  field: string | null;
  started_year: number | null;
  ended_year: number | null;
}

export interface CandidatePortfolioItem {
  id: string;
  title: string;
  description: string | null;
  type: Enums<"portfolio_type">;
  media: { path: string; url: string }[];
  link_url: string | null;
}

export interface CandidatePreferences {
  employment_types: Enums<"employment_type">[];
  schedules: Enums<"work_schedule">[];
  work_time_from: string | null;
  work_time_to: string | null;
  salary_min: number | null;
  salary_expected: number | null;
  salary_type: Enums<"salary_type">;
  availability: Enums<"availability">;
  official_terms: string[];
}

export interface CandidateProfile {
  id: string;
  profile_id: string;
  first_name: string;
  last_initial: string | null;
  avatar_url: string | null;
  birth_date: string | null;
  gender: Enums<"gender"> | null;
  headline: string | null;
  about: string | null;
  experience_level: Enums<"experience_level">;
  status: Enums<"worker_status">;
  remote_preference: Enums<"remote_preference">;
  work_format: Enums<"work_format">;
  completeness: number;
  views_count: number;
  last_active_at: string;
  region: NamedRow | null;
  district: NamedRow | null;
  category: (NamedRow & { id: string; slug: string; icon: string | null }) | null;
  subcategory: NamedRow | null;
  preferences: CandidatePreferences | null;
  work_districts: (NamedRow & { id: string })[];
  skills: CandidateSkill[];
  languages: CandidateLanguage[];
  experience: CandidateExperience[];
  education: CandidateEducation[];
  portfolio: CandidatePortfolioItem[];
}

export interface CandidateMatch {
  score: number;
  reasons: MatchReason[];
}

export interface CandidateReview {
  id: string;
  rating: number;
  text: string | null;
  created_at: string;
  author_name: string;
  author_avatar: string | null;
}

export interface CandidateRating {
  avg: number | null;
  count: number;
}

export interface CandidateInteractions {
  /** Mavjud ariza/taklif asosida chat havolasi (yo'q bo'lsa null) */
  chatHref: string | null;
  /** Hozir kutilayotgan (sent/viewed) takliflar bo'yicha vakansiya id'lari */
  offeredVacancyIds: string[];
}

export interface SavedEntry {
  folder: string | null;
  note: string | null;
}

export interface SavedWorkerItem {
  worker_id: string;
  folder: string | null;
  note: string | null;
  created_at: string;
  /** RLS yashirgan bo'lsa null (profil yopilgan/o'chirilgan) */
  card: WorkerCardData | null;
}
