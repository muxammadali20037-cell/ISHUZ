import type { Database, Enums, Tables } from "@/types/database.types";
import type { MatchReason } from "@/components/shared/match-score";
import type { VacancyCardData } from "@/components/shared/vacancy-card";

/** search_vacancies RPC qatori */
export type VacancySearchRow = Database["public"]["Functions"]["search_vacancies"]["Returns"][number];

/** Client komponentlarga uzatiladigan ma'lumotnoma elementlari (server-only reference.ts dan ajratilgan) */
export interface RefItem {
  id: string;
  slug: string;
  name_uz: string;
  name_ru: string;
}
export interface CategoryItem extends RefItem {
  icon: string | null;
}
export interface SubcategoryItem extends RefItem {
  category_id: string;
}
export interface DistrictItem extends RefItem {
  region_id: string;
}
export interface BenefitItem {
  code: string;
  name_uz: string;
  name_ru: string;
  kind: string;
}

/** Filtr sheet'lari uchun ma'lumotnoma to'plami */
export interface JobsFilterRefs {
  categories: CategoryItem[];
  subcategories: SubcategoryItem[];
  regions: RefItem[];
  districts: DistrictItem[];
  benefits: BenefitItem[];
}

export type NamedRow = { name_uz: string; name_ru: string };

/** /jobs/[slug] uchun to'liq vakansiya (join'lar bilan) */
export interface VacancyDetail extends Tables<"vacancies"> {
  company: {
    id: string;
    slug: string;
    name: string;
    logo_url: string | null;
    about: string | null;
    website: string | null;
    size: Enums<"company_size"> | null;
    verification_status: Enums<"verification_status">;
    phone?: string | null;
    telegram?: string | null;
  } | null;
  category: RefItem | null;
  subcategory: RefItem | null;
  /** kasblar daraxtidagi aniq kasb */
  profession: { id: string; name_uz: string; name_ru: string; name_en: string | null } | null;
  region: RefItem | null;
  district: RefItem | null;
  skills: { id: string; slug: string; name_uz: string; name_ru: string; is_required: boolean }[];
  languages: { code: string; name_uz: string; name_ru: string; min_level: Enums<"language_level"> }[];
  benefits: BenefitItem[];
  /** official_terms kodlari → nomlar */
  officialTerms: BenefitItem[];
}

export type ViewerKind = "guest" | "no_worker" | "worker" | "manager";

/** Ko'ruvchining vakansiyaga munosabati (server tekshiruvi) */
export interface VacancyViewerState {
  kind: ViewerKind;
  isSaved: boolean;
  application: { id: string; status: Enums<"application_status"> } | null;
  match: { score: number; reasons: MatchReason[] } | null;
}

export interface WorkerDashboardStats {
  applications: number;
  active_applications: number;
  offers: number;
  profile_views: number;
  saved: number;
  completeness: number;
}

export interface WorkerHomeContext {
  categoryId: string | null;
  categorySlug: string | null;
  regionId: string | null;
  districtIds: string[];
}

export interface SavedVacancyItem {
  vacancyId: string;
  savedAt: string;
  /** null — vakansiya endi faol emas (RLS ko'rsatmaydi) */
  card: VacancyCardData | null;
}
