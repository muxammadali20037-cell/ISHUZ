import type { Enums } from "@/types/database.types";

/** Aniq koordinata (worker_geo / vacancies.lat,lng). */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/** worker_preferences qatori. */
export interface WorkerMatchPreferences {
  employmentTypes: Enums<"employment_type">[];
  schedules: Enums<"work_schedule">[];
  salaryMin: number | null;
  salaryExpected: number | null;
}

/** worker_languages qatori. */
export interface WorkerLanguage {
  code: string;
  level: Enums<"language_level">;
}

/**
 * Ish qidiruvchi tomonidagi kirish ma'lumotlari.
 * Manba: worker_profiles + profiles.birth_date + worker_preferences + worker_skills +
 * worker_languages + worker_education + worker_geo + worker_locations.
 */
export interface WorkerMatchInput {
  categoryId: string | null;
  subcategoryId: string | null;
  districtId: string | null;
  regionId: string | null;
  /** worker_locations.district_id[] — ishlay oladigan tumanlar */
  workDistrictIds: string[];
  remotePreference: Enums<"remote_preference">;
  workFormat: Enums<"work_format">;
  experienceLevel: Enums<"experience_level">;
  /** profiles.birth_date — ISO sana (YYYY-MM-DD) */
  birthDate: string | null;
  /** worker_preferences qatori; qator bo'lmasa null */
  preferences: WorkerMatchPreferences | null;
  /** worker_skills.skill_id[] */
  skillIds: string[];
  languages: WorkerLanguage[];
  /** worker_education.level[] */
  educationLevels: Enums<"education_level">[];
  /** worker_geo; noma'lum bo'lsa null */
  geo: GeoPoint | null;
}

/** vacancy_languages qatori. */
export interface VacancyLanguage {
  code: string;
  minLevel: Enums<"language_level">;
}

/**
 * Vakansiya tomonidagi kirish ma'lumotlari.
 * Manba: vacancies + vacancy_skills + vacancy_languages.
 */
export interface VacancyMatchInput {
  categoryId: string | null;
  subcategoryId: string | null;
  districtId: string | null;
  regionId: string | null;
  isRemote: boolean;
  lat: number | null;
  lng: number | null;
  salaryFrom: number | null;
  salaryTo: number | null;
  salaryNegotiable: boolean;
  experienceMinMonths: number;
  employmentType: Enums<"employment_type">;
  schedule: Enums<"work_schedule">;
  workFormat: Enums<"work_format">;
  /**
   * vacancy_skills.skill_id[] — SQL `count(*)` barcha vacancy_skills qatorlarini sanaydi
   * (is_required dan qat'i nazar), shuning uchun bu yerga ham hammasi beriladi.
   */
  requiredSkillIds: string[];
  /** vacancy_languages — SQL tartibida (PK: language_code bo'yicha) bering */
  languages: VacancyLanguage[];
  educationMin: Enums<"education_level"> | null;
  ageMin: number | null;
  ageMax: number | null;
}

/** compute_match chiqaradigan barcha sabab kalitlari (i18n: `enums.match_reason.<key>`). */
export const MATCH_REASON_KEYS = [
  "category_match",
  "category_match_partial",
  "category_mismatch",
  "remote_ok",
  "district_match",
  "distance_near",
  "distance_ok",
  "region_match",
  "location_far",
  "salary_unspecified",
  "salary_negotiable",
  "salary_ok",
  "salary_min_ok",
  "salary_below",
  "experience_ok",
  "experience_close",
  "experience_low",
  "skills_not_required",
  "skills_matched",
  "schedule_ok",
  "schedule_partial",
  "schedule_mismatch",
  "employment_ok",
  "employment_mismatch",
  "work_format_ok",
  "work_format_mismatch",
  "language_required",
  "languages_ok",
  "education_required",
  "age_out_of_range",
] as const;

export type MatchReasonKey = (typeof MATCH_REASON_KEYS)[number];

/**
 * Bitta moslik sababi. `key` va `ok` dan tashqari parametrlar SQL bilan bir xil:
 * km (1 kasr), matched/required, required_months, vacancy_max/worker_min, vacancy_schedule,
 * vacancy_type, vacancy_format, lang/level, level, min/max. SQL `jsonb_build_object` null
 * qiymatlarni saqlaydi — shuning uchun bu yerda ham `null` aniq beriladi (`undefined` emas).
 */
export interface MatchReason {
  key: string;
  ok: boolean | "warn";
  [param: string]: unknown;
}

export interface MatchResult {
  /** 0..100 */
  score: number;
  reasons: MatchReason[];
}

export interface MatchOptions {
  /** Yosh hisoblash uchun "hozir" (determinizm uchun testlarda beriladi). Default: new Date(). */
  now?: Date;
}

/**
 * Almashtiriladigan moslik dvigateli. Hozir `rule_based` (SQL compute_match nusxasi);
 * kelajakda AI/embedding asosidagi dvigatel ham shu interfeysni amalga oshiradi.
 */
export interface MatchEngine {
  name: string;
  compute(worker: WorkerMatchInput, vacancy: VacancyMatchInput, opts?: MatchOptions): MatchResult;
}

export type MatchEngineKind = "rule_based";

export type MatchTone = "high" | "medium" | "low";

export interface ReasonSummary {
  positives: number;
  warnings: number;
  negatives: number;
}
