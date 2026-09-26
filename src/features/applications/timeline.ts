import { PIPELINE_STATUSES, type ApplicationStatus } from "./types";

/** Timeline uchun minimal event shakli (application_events qatori bilan mos) */
export interface TimelineEventLike {
  id?: number;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  actor_id: string | null;
  note: string | null;
  created_at: string;
}

export type StepState = "completed" | "current" | "upcoming";

export interface TimelineStep {
  status: ApplicationStatus;
  state: StepState;
  /** rejected / withdrawn — qizil yakuniy qadam */
  terminal: boolean;
  /** Ushbu holatga o'tilgan vaqt (event bo'lmasa null) */
  at: string | null;
  actorId: string | null;
  note: string | null;
  fromStatus: ApplicationStatus | null;
  /** Bosqich tashlab o'tilgan (event yo'q, lekin keyingi bosqichga yetilgan) */
  implicit: boolean;
}

export type ActorRole = "worker" | "employer" | "system";

/** Eventlarni xronologik tartiblaydi (vaqt, keyin id) */
export function sortEvents<T extends TimelineEventLike>(events: readonly T[]): T[] {
  return [...events].sort((a, b) => {
    const dt = Date.parse(a.created_at) - Date.parse(b.created_at);
    if (dt !== 0 && !Number.isNaN(dt)) return dt;
    return (a.id ?? 0) - (b.id ?? 0);
  });
}

function pipelineIndex(status: ApplicationStatus): number {
  return (PIPELINE_STATUSES as readonly ApplicationStatus[]).indexOf(status);
}

/**
 * Ariza holati tarixidan vertikal stepper quradi.
 * - Kanonik bosqichlar: sent → viewed → shortlisted → interview → offered → hired.
 * - Joriy holatgacha bo'lgan bosqichlar `completed` (event bo'lmasa `implicit`), joriy `current`, keyingilari `upcoming`.
 * - rejected / withdrawn: yetilgan bosqichgacha `completed`, so'ng qizil `terminal` qadam; `upcoming` ko'rsatilmaydi.
 */
export function buildTimeline(events: readonly TimelineEventLike[], status: ApplicationStatus): TimelineStep[] {
  const sorted = sortEvents(events);
  const latestByStatus = new Map<ApplicationStatus, TimelineEventLike>();
  for (const e of sorted) latestByStatus.set(e.to_status, e);

  const terminal = status === "rejected" || status === "withdrawn";
  let reachedIdx: number;
  if (!terminal) {
    reachedIdx = Math.max(0, pipelineIndex(status));
  } else {
    const termEvent = latestByStatus.get(status);
    const fromIdx = termEvent?.from_status ? pipelineIndex(termEvent.from_status) : -1;
    const maxEventIdx = sorted.reduce((m, e) => Math.max(m, pipelineIndex(e.to_status)), -1);
    reachedIdx = Math.max(fromIdx, maxEventIdx, 0);
  }

  const steps: TimelineStep[] = [];
  PIPELINE_STATUSES.forEach((s, i) => {
    if (terminal && i > reachedIdx) return;
    const ev = latestByStatus.get(s);
    const state: StepState = i < reachedIdx ? "completed" : i === reachedIdx ? (terminal ? "completed" : "current") : "upcoming";
    const reached = state !== "upcoming";
    steps.push({
      status: s,
      state,
      terminal: false,
      at: reached ? (ev?.created_at ?? null) : null,
      actorId: reached ? (ev?.actor_id ?? null) : null,
      note: reached ? (ev?.note ?? null) : null,
      fromStatus: reached ? (ev?.from_status ?? null) : null,
      implicit: reached && !ev,
    });
  });

  if (terminal) {
    const ev = latestByStatus.get(status);
    steps.push({
      status,
      state: "current",
      terminal: true,
      at: ev?.created_at ?? null,
      actorId: ev?.actor_id ?? null,
      note: ev?.note ?? null,
      fromStatus: ev?.from_status ?? null,
      implicit: !ev,
    });
  }
  return steps;
}

/** Qadamni kim bajargan: ishchi (profil id mos), ish beruvchi (boshqa odam) yoki tizim (actor yo'q) */
export function actorRole(actorId: string | null, workerProfileId: string | null | undefined): ActorRole {
  if (!actorId) return "system";
  return workerProfileId && actorId === workerProfileId ? "worker" : "employer";
}

/** Tizim eslatmalari (RPC yozadi) — UI tarjima qiladi */
export const SYSTEM_NOTES = ["offer_accepted", "offer_hired"] as const;
export type SystemNote = (typeof SYSTEM_NOTES)[number];
export function systemNote(note: string | null): SystemNote | null {
  return note && (SYSTEM_NOTES as readonly string[]).includes(note) ? (note as SystemNote) : null;
}
