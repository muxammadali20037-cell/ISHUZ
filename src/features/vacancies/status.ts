import type { VacancyStatus } from "./types";

/** URL ?status= filtrlari */
export const STATUS_FILTERS = ["all", "active", "draft", "pending_review", "paused", "closed", "expired", "hidden"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export function parseStatusFilter(value: string | string[] | undefined): StatusFilter {
  const v = Array.isArray(value) ? value[0] : value;
  return (STATUS_FILTERS as readonly string[]).includes(v ?? "") ? (v as StatusFilter) : "all";
}

/** "hidden" filtri admin yashirgan va rad etgan vakansiyalarni birga ko'rsatadi */
export function filterMatches(filter: StatusFilter, status: VacancyStatus): boolean {
  if (filter === "all") return true;
  if (filter === "hidden") return status === "hidden" || status === "rejected";
  return filter === status;
}

export type BadgeTone = "default" | "primary" | "success" | "warning" | "destructive" | "outline";

export const STATUS_TONE: Record<VacancyStatus, BadgeTone> = {
  draft: "default",
  pending_review: "warning",
  active: "success",
  paused: "warning",
  closed: "outline",
  expired: "outline",
  hidden: "destructive",
  rejected: "destructive",
};

/** publish_vacancy RPC qabul qiladigan holatlar */
export function canPublish(status: VacancyStatus): boolean {
  return status === "draft" || status === "paused" || status === "closed" || status === "expired" || status === "rejected";
}

export function canPause(status: VacancyStatus): boolean {
  return status === "active";
}

/** set_vacancy_status('closed') ta'sir qiladigan holatlar (draft/expired uchun ma'nosiz) */
export function canClose(status: VacancyStatus): boolean {
  return status === "active" || status === "paused" || status === "pending_review";
}

/** RLS: draft/closed/expired/rejected va arizasiz */
export function canDelete(status: VacancyStatus, applicationsCount: number): boolean {
  return applicationsCount === 0 && (status === "draft" || status === "closed" || status === "expired" || status === "rejected");
}

/** Admin yashirgan vakansiyaga egasi tega olmaydi */
export function isLocked(status: VacancyStatus): boolean {
  return status === "hidden";
}

/** Tahrirlash mumkinmi (holat bo'yicha; ruxsat alohida tekshiriladi) */
export function isEditable(status: VacancyStatus): boolean {
  return !isLocked(status);
}

/** Faol vakansiya ochiq sahifada ko'rinadi */
export function isPublic(status: VacancyStatus): boolean {
  return status === "active";
}

/** Ro'yxat harakat tugmasi uchun "e'lon qilish" yorlig'i varianti */
export function publishLabelKey(status: VacancyStatus): "publish" | "resume" | "republish" | "resubmit" {
  if (status === "draft") return "publish";
  if (status === "paused") return "resume";
  if (status === "rejected") return "resubmit";
  return "republish";
}
