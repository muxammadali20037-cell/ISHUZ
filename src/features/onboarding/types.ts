import type { Enums, Tables } from "@/types/database.types";

/** Onboarding qadamlari: 1..8 — savollar, 9 — yakuniy tekshiruv */
export const TOTAL_STEPS = 8;
export const REVIEW_STEP = 9;
export const WIZARD_PATH = "/onboarding/worker";

export const STEP_KEYS = ["personal", "location", "profession", "experience", "skills", "education", "portfolio", "preferences", "review"] as const;
export type StepKey = (typeof STEP_KEYS)[number];

/** "Keyinroq" tugmasi bo'lgan qadamlar */
export const SKIPPABLE_STEPS = [6, 7] as const;
export type SkippableStep = (typeof SKIPPABLE_STEPS)[number];

export type DraftProfile = Pick<Tables<"profiles">, "first_name" | "last_name" | "birth_date" | "gender" | "avatar_url">;
export type DraftContacts = Pick<Tables<"profile_contacts">, "phone" | "phone_verified_at" | "telegram_username">;
export type DraftWorker = Pick<
  Tables<"worker_profiles">,
  | "id"
  | "headline"
  | "category_id"
  | "subcategory_id"
  | "experience_level"
  | "region_id"
  | "district_id"
  | "area_hint"
  | "remote_preference"
  | "work_format"
  | "onboarding_step"
  | "onboarding_completed_at"
  | "completeness"
>;

export type DraftSkill = { skill_id: string; level: Enums<"skill_level">; name_uz: string; name_ru: string };
export type DraftLanguage = { language_code: string; level: Enums<"language_level"> };
export type DraftExperience = Tables<"worker_experience">;
export type DraftEducation = Tables<"worker_education">;
export type DraftPortfolio = Tables<"worker_portfolio">;
export type DraftPreferences = Tables<"worker_preferences">;

/** Wizard uchun saqlangan qoralama (barcha qadamlar) */
export interface WorkerDraft {
  workerId: string | null;
  /** Saqlangan qadam (1..9). Worker profili yo'q bo'lsa 1 */
  onboardingStep: number;
  profile: DraftProfile;
  contacts: DraftContacts | null;
  worker: DraftWorker | null;
  /** worker_locations.district_id */
  locations: string[];
  hasGeo: boolean;
  skills: DraftSkill[];
  languages: DraftLanguage[];
  experience: DraftExperience[];
  education: DraftEducation[];
  portfolio: DraftPortfolio[];
  preferences: DraftPreferences | null;
}

/** Ko'nikma tanlash uchun yengil yozuv */
export type SkillOption = Pick<Tables<"skills">, "id" | "name_uz" | "name_ru" | "category_id">;

/** Yuklash cheklovlari (bucket'lar bilan bir xil: 0011_storage.sql) */
export const AVATAR_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const AVATAR_MAX_MB = 3;
export const PORTFOLIO_MAX_MB = 25;
export const PORTFOLIO_MAX_FILES = 10;
export const PORTFOLIO_MIME: Record<Exclude<Enums<"portfolio_type">, "link">, readonly string[]> = {
  image: ["image/jpeg", "image/png", "image/webp"],
  video: ["video/mp4"],
  pdf: ["application/pdf"],
  document: ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/pdf"],
};

/** Kasbga qarab savol: javob — ko'nikmalar (worker_skills) */
export interface SkillQuestion {
  id: string;
  title_uz: string;
  title_ru: string;
  hint_uz: string | null;
  hint_ru: string | null;
  options: { id: string; name_uz: string; name_ru: string }[];
}
