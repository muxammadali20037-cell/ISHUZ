import type { PickedProfession } from "@/features/professions/types";
import type { Enums } from "@/types/database.types";

/** Sodda tajriba tanlovi (ishchi) ↔ bazadagi experience_level */
export type SimpleExperience = "none" | "lt1" | "1_3" | "3plus";
export const SIMPLE_EXPERIENCE: SimpleExperience[] = ["none", "lt1", "1_3", "3plus"];

export function experienceToLevel(e: SimpleExperience): Enums<"experience_level"> {
  return e === "none" ? "none" : e === "lt1" ? "6_12m" : e === "1_3" ? "1_2y" : "3_5y";
}

export function levelToExperience(level: Enums<"experience_level"> | null | undefined): SimpleExperience | null {
  if (!level) return null;
  if (level === "none") return "none";
  if (level === "lt_6m" || level === "6_12m") return "lt1";
  if (level === "1_2y" || level === "2_3y") return "1_3";
  return "3plus";
}

/** Ish beruvchi turi (sodda tanlov) */
export type SimpleEmployerType = "company" | "government" | "individual_entrepreneur" | "person";
export const SIMPLE_EMPLOYER_TYPES: SimpleEmployerType[] = ["company", "government", "individual_entrepreneur", "person"];

export function toSimpleEmployerType(t: Enums<"employer_type"> | null | undefined): SimpleEmployerType | null {
  if (!t) return null;
  if (t === "government" || t === "individual_entrepreneur" || t === "person") return t;
  if (t === "self_employed") return "person";
  return "company";
}

/** Vakansiya tajriba talabi (oy) */
export const VACANCY_EXPERIENCE = [0, 12, 36] as const;
export type VacancyExperience = (typeof VACANCY_EXPERIENCE)[number];

export const SCHEDULES: Enums<"work_schedule">[] = ["5_2", "6_1", "2_2", "shift", "flexible"];

/** Hudud tanlovi: viloyat → tuman (yoki butun viloyat). Masofadan — hudud talab qilinmaydi (vakansiya) */
export interface PlaceChoice {
  regionId: string | null;
  districtId: string | null;
  /** foydalanuvchi tuman bo'yicha qaror qildi (aniq tuman yoki "butun viloyat") */
  districtChosen: boolean;
  remote: boolean;
}

export const EMPTY_PLACE: PlaceChoice = { regionId: null, districtId: null, districtChosen: false, remote: false };

export interface WorkerDraft {
  v: 1;
  step: number;
  profession: PickedProfession | null;
  place: PlaceChoice;
  /** ishchi: viloyat tanlanadi + "masofadan ham ishlay olaman" belgisi */
  remoteOk: boolean;
  firstName: string;
  lastName: string;
  phone: string;
  about: string;
  experience: SimpleExperience | null;
  salary: string;
  schedule: Enums<"work_schedule"> | "";
  showPhone: boolean;
}

export interface VacancyDraft {
  v: 1;
  step: number;
  /** ikki marta bosish takroriy e'lon yaratmasligi uchun (serverda unique) */
  clientRef: string;
  /** tahrirlanayotgan vakansiya */
  editId: string | null;
  profession: PickedProfession | null;
  place: PlaceChoice;
  employerType: SimpleEmployerType | null;
  orgName: string;
  phone: string;
  description: string;
  salaryFrom: string;
  salaryTo: string;
  negotiable: boolean;
  title: string;
  schedule: Enums<"work_schedule"> | "";
  experienceMonths: VacancyExperience;
  showPhone: boolean;
}

/**
 * E'lonning haqiqiy holati (my_listing_state): faqat "listed"/"active" — ommaga chiqqan.
 * moderation_pending — tekshiruv kutilmoqda; review — moderator ko'radi; rejected — sababi bilan rad etildi;
 * verification_pending — tekshiruvdan o'tdi, ish beruvchi tasdiqlanishini kutmoqda; payment_required — to'lov kerak.
 */
export type ListingState =
  | "listed"
  | "active"
  | "moderation_pending"
  | "review"
  | "rejected"
  | "verification_pending"
  | "payment_required"
  | "saved"
  | "closed"
  | "expired"
  | "paused"
  | "hidden";
export type WorkerPublishState = ListingState;
export type VacancyPublishState = ListingState;

export interface ListingStateInfo {
  state: ListingState;
  message: string | null;
  fields: string[];
  category: string | null;
  canAppeal: boolean;
}

export function toListingStateInfo(raw: unknown): ListingStateInfo {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    state: (typeof r.state === "string" ? r.state : "saved") as ListingState,
    message: typeof r.message === "string" && r.message.trim() ? r.message : null,
    fields: Array.isArray(r.fields) ? r.fields.filter((x): x is string => typeof x === "string") : [],
    category: typeof r.category === "string" ? r.category : null,
    canAppeal: r.can_appeal === true,
  };
}

/** Kirgan foydalanuvchi haqida sahifaga beriladigan ma'lumot */
export interface PostViewer {
  loggedIn: boolean;
  phone: string | null;
  phoneVerified: boolean;
  firstName: string;
  lastName: string;
}
