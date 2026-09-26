import type { Enums } from "@/types/database.types";
import type { MatchReason } from "@/components/shared/match-score";

export type ApplicationStatus = Enums<"application_status">;

/** Kanonik bosqichlar (oldinga qarab): sent → viewed → shortlisted → interview → offered → hired */
export const PIPELINE_STATUSES = ["sent", "viewed", "shortlisted", "interview", "offered", "hired"] as const satisfies readonly ApplicationStatus[];
/** Yakuniy holatlar — bulardan keyin o'zgartirib bo'lmaydi (RPC `application_closed`) */
export const TERMINAL_STATUSES = ["hired", "rejected", "withdrawn"] as const satisfies readonly ApplicationStatus[];
/** Ishchi ro'yxati: "Faol" tab */
export const ACTIVE_STATUSES = ["sent", "viewed", "shortlisted", "interview", "offered"] as const satisfies readonly ApplicationStatus[];
/** Ishchi ro'yxati: "Arxiv" tab */
export const ARCHIVE_STATUSES = ["hired", "rejected", "withdrawn"] as const satisfies readonly ApplicationStatus[];
/** Ish beruvchi filtrlari tartibi */
export const ALL_STATUSES = ["sent", "viewed", "shortlisted", "interview", "offered", "hired", "rejected", "withdrawn"] as const satisfies readonly ApplicationStatus[];

export type StatusTone = "info" | "primary" | "success" | "destructive" | "muted";

/** Dizayn: sent/viewed — neytral ko'k, shortlisted/interview — primary, offered/hired — success, rejected — destructive, withdrawn — muted */
export const STATUS_TONE: Record<ApplicationStatus, StatusTone> = {
  sent: "info",
  viewed: "info",
  shortlisted: "primary",
  interview: "primary",
  offered: "success",
  hired: "success",
  rejected: "destructive",
  withdrawn: "muted",
};

export function isTerminalStatus(status: ApplicationStatus): boolean {
  return (TERMINAL_STATUSES as readonly ApplicationStatus[]).includes(status);
}

export function isActiveStatus(status: ApplicationStatus): boolean {
  return (ACTIVE_STATUSES as readonly ApplicationStatus[]).includes(status);
}

/** Ish beruvchi hozirgi holatdan qaysi holatlarga o'tkaza oladi (RPC: faqat oldinga, rejected istalgan vaqtda) */
export type EmployerStatus = Extract<ApplicationStatus, "shortlisted" | "interview" | "offered" | "hired" | "rejected">;
export const EMPLOYER_NEXT_STATUSES: Record<ApplicationStatus, EmployerStatus[]> = {
  sent: ["shortlisted", "interview", "offered", "rejected"],
  viewed: ["shortlisted", "interview", "offered", "rejected"],
  shortlisted: ["interview", "offered", "hired", "rejected"],
  interview: ["offered", "hired", "rejected"],
  offered: ["hired", "rejected"],
  hired: [],
  rejected: [],
  withdrawn: [],
};

export type ApplicationEvent = {
  id: number;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  actor_id: string | null;
  note: string | null;
  created_at: string;
};

export interface CompanySummary {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  verification_status: Enums<"verification_status">;
}

export interface VacancySummary {
  id: string;
  title: string;
  slug: string;
  status: Enums<"vacancy_status">;
  salary_from: number | null;
  salary_to: number | null;
  salary_type: Enums<"salary_type">;
  salary_negotiable: boolean;
  /** Egasi (kompaniya vakansiyasida null bo'lishi mumkin) */
  owner_profile_id: string | null;
  company_id: string | null;
  company: CompanySummary | null;
}

export interface ReviewSummary {
  id: string;
  rating: number;
  text: string | null;
  status: Enums<"review_status">;
  created_at: string;
}

/** Ishchi uchun ro'yxat elementi. `vacancy` null bo'lishi mumkin (RLS: faol bo'lmagan vakansiya ko'rinmaydi) */
export interface WorkerApplicationItem {
  id: string;
  status: ApplicationStatus;
  match_score: number | null;
  created_at: string;
  updated_at: string;
  vacancy: VacancySummary | null;
}

export interface WorkerApplicationDetail extends WorkerApplicationItem {
  cover_message: string | null;
  match_reasons: MatchReason[] | null;
  viewed_at: string | null;
  events: ApplicationEvent[];
  my_review: ReviewSummary | null;
}

/** Nomzod qisqacha (ish beruvchi ko'radi). `null` — profil yopiq (RLS) */
export interface CandidateSummary {
  worker_id: string;
  profile_id: string;
  first_name: string;
  last_initial: string | null;
  avatar_url: string | null;
  headline: string | null;
  experience_level: Enums<"experience_level">;
}

export interface EmployerApplicationItem {
  id: string;
  vacancy_id: string;
  status: ApplicationStatus;
  match_score: number | null;
  cover_message: string | null;
  created_at: string;
  updated_at: string;
  candidate: CandidateSummary | null;
}

export interface EmployerApplicationDetail extends EmployerApplicationItem {
  match_reasons: MatchReason[] | null;
  viewed_at: string | null;
  events: ApplicationEvent[];
  my_review: ReviewSummary | null;
  vacancy: { id: string; title: string; slug: string; status: Enums<"vacancy_status"> } | null;
}

export type PipelineStatusFilter = ApplicationStatus | "all";
export type PipelineSort = "match" | "newest";
export type PipelineCounts = Record<PipelineStatusFilter, number>;

export interface ManagedVacancy {
  id: string;
  title: string;
  slug: string;
  status: Enums<"vacancy_status">;
  owner_profile_id: string | null;
  company_id: string | null;
}

/** jsonb match_reasons → MatchReason[] (noto'g'ri shakl bo'lsa null) */
export function parseMatchReasons(value: unknown): MatchReason[] | null {
  if (!Array.isArray(value)) return null;
  const out: MatchReason[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.key !== "string") continue;
    const ok = rec.ok === true || rec.ok === "warn" ? rec.ok : false;
    out.push({ ...rec, key: rec.key, ok });
  }
  return out.length ? out : null;
}

export function isPipelineSort(v: unknown): v is PipelineSort {
  return v === "match" || v === "newest";
}

export function isApplicationStatus(v: unknown): v is ApplicationStatus {
  return typeof v === "string" && (ALL_STATUSES as readonly string[]).includes(v);
}
