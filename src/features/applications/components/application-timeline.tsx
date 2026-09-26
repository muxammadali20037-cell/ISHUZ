"use client";

import { useMemo } from "react";
import { Check, X, Undo2, Circle } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { STATUS_TONE, type ApplicationEvent, type ApplicationStatus } from "../types";
import { actorRole, buildTimeline, systemNote, type TimelineStep } from "../timeline";
import { TONE_FILL, TONE_RING } from "./tone";

export function ApplicationTimeline({
  events,
  status,
  workerProfileId,
  viewer,
  className,
}: {
  events: ApplicationEvent[];
  status: ApplicationStatus;
  /** Nomzodning profil id'si — "Siz" / "Nomzod" / "Ish beruvchi" ni aniqlash uchun */
  workerProfileId: string | null;
  viewer: "worker" | "employer";
  className?: string;
}) {
  const { t, locale } = useT();
  const steps = useMemo(() => buildTimeline(events, status), [events, status]);

  const actorLabel = (step: TimelineStep) => {
    const role = actorRole(step.actorId, workerProfileId);
    if (role === "system") return t("applications.timeline.system");
    if (role === "worker") return viewer === "worker" ? t("applications.timeline.you") : t("applications.timeline.candidate");
    return viewer === "employer" ? t("applications.timeline.you") : t("applications.timeline.employer");
  };

  return (
    <ol className={cn("relative", className)}>
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        const tone = STATUS_TONE[step.status];
        const reached = step.state !== "upcoming";
        const filled = step.state === "completed" || step.terminal || step.status === "hired";
        const circle = step.terminal
          ? TONE_FILL[tone]
          : step.state === "completed"
            ? TONE_FILL.primary
            : step.state === "current"
              ? cn(filled ? TONE_FILL[tone] : "bg-card ring-4", TONE_RING[tone])
              : "border-dashed border-border bg-card text-muted-foreground";
        const Icon = step.terminal ? (step.status === "withdrawn" ? Undo2 : X) : filled ? Check : Circle;
        const sys = systemNote(step.note);
        const noteText = sys ? t(`applications.timeline.note_${sys}`) : step.note;
        return (
          <li key={`${step.status}-${i}`} className="relative flex gap-3 pb-6 last:pb-0">
            {!last ? <span className={cn("absolute left-[15px] top-8 h-[calc(100%-1.25rem)] w-0.5 rounded-full", step.state === "completed" ? "bg-primary/60" : "bg-border")} aria-hidden /> : null}
            <span className={cn("relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors", circle)}>
              <Icon className={cn("size-4", Icon === Circle && "size-2.5 fill-current")} strokeWidth={2.75} />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className={cn("text-sm font-semibold leading-tight", !reached && "text-muted-foreground", step.terminal && tone === "destructive" && "text-destructive")}>
                {t(`applications.timeline.step_${step.status}`)}
              </p>
              {!reached ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{t("applications.timeline.upcoming")}</p>
              ) : step.at ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {actorLabel(step)} · {formatDateTime(step.at, locale)}
                </p>
              ) : null}
              {noteText ? <p className="mt-2 rounded-xl bg-secondary px-3 py-2 text-sm leading-snug">{noteText}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
