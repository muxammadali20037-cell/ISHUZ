import type { Enums } from "@/types/database.types";

/** Namuna (demo) vakansiya kartasi — public.demo_vacancies_public() qaytargan qator (haqiqiy vakansiya kartasi nomlari bilan) */
export interface DemoVacancy {
  id: string;
  slug: string;
  title_uz: string;
  title_ru: string | null;
  title_en: string | null;
  category_slug: string | null;
  category_icon: string | null;
  region_name_uz: string | null;
  region_name_ru: string | null;
  region_name_en: string | null;
  region_name_oz: string | null;
  district_name_uz: string | null;
  district_name_ru: string | null;
  district_name_en: string | null;
  district_name_oz: string | null;
  lat: number | null;
  lng: number | null;
  is_remote: boolean;
  salary_from: number | null;
  salary_to: number | null;
  salary_type: Enums<"salary_type">;
  salary_negotiable: boolean;
  schedule: Enums<"work_schedule">;
  employment_type: Enums<"employment_type">;
  experience_min_months: number;
}

export interface DemoVacancyDetail extends Omit<DemoVacancy, "lat" | "lng"> {
  category_name_uz: string | null;
  category_name_ru: string | null;
  category_name_en: string | null;
}

export interface DemoVacancyList {
  items: DemoVacancy[];
  total: number;
}

export const DEMO_VACANCIES_PAGE = 24;
