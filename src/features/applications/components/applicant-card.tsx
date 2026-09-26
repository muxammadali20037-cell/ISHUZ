"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreVertical, ListChecks, CalendarClock, XCircle, Briefcase, Clock, UserX } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatRelative, initials, shortName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MatchScore } from "@/components/shared/match-score";
import { EMPLOYER_NEXT_STATUSES, type EmployerApplicationItem } from "../types";
import { ApplicationStatusBadge } from "./status-badge";
import { StatusSheet, type SheetStatus } from "./status-sheet";
import { useStatusChange } from "./use-status-change";

/** Ish beruvchi pipeline'idagi nomzod kartasi + tezkor amallar */
export function ApplicantCard({ item, canAct, className }: { item: EmployerApplicationItem; canAct: boolean; className?: string }) {
  const { t, tEnum, locale } = useT();
  const { pending, run } = useStatusChange({ applicationId: item.id, vacancyId: item.vacancy_id });
  const [sheet, setSheet] = useState<SheetStatus | null>(null);
  const c = item.candidate;
  const href = `/employer/vacancies/${item.vacancy_id}/applications/${item.id}`;
  const name = c ? shortName(c.first_name, c.last_initial) : t("applications.pipeline.candidate_hidden");
  const next = EMPLOYER_NEXT_STATUSES[item.status];
  const quick = (["shortlisted", "interview", "rejected"] as const).filter((s) => next.includes(s));

  return (
    <article className={cn("relative rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-shadow hover:shadow-md", item.status === "sent" && "border-sky-300/70 dark:border-sky-800", className)}>
      <Link href={href} className="absolute inset-0 rounded-2xl" aria-label={name} />
      <div className="flex items-start gap-3">
        {c ? <Avatar src={c.avatar_url} fallback={initials(c.first_name, c.last_initial)} size="lg" alt="" /> : <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground"><UserX className="size-6" /></div>}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className={cn("truncate text-base font-semibold", !c && "text-muted-foreground")}>{name}</h3>
            <div className="flex shrink-0 items-center gap-1">
              <MatchScore score={item.match_score} />
              {canAct && quick.length ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon-sm" className="relative z-10 -mr-2" aria-label={t("applications.pipeline.actions")} disabled={pending}>
                      <MoreVertical className="size-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {quick.includes("shortlisted") ? (
                      <DropdownMenuItem onSelect={() => void run("shortlisted")}>
                        <ListChecks /> {t("applications.pipeline.quick_shortlist")}
                      </DropdownMenuItem>
                    ) : null}
                    {quick.includes("interview") ? (
                      <DropdownMenuItem onSelect={() => setSheet("interview")}>
                        <CalendarClock /> {t("applications.pipeline.quick_interview")}
                      </DropdownMenuItem>
                    ) : null}
                    {quick.includes("rejected") ? (
                      <DropdownMenuItem destructive onSelect={() => setSheet("rejected")}>
                        <XCircle /> {t("applications.pipeline.quick_reject")}
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          </div>
          {c?.headline ? <p className="truncate text-sm text-foreground/90">{c.headline}</p> : null}
          {c ? (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Briefcase className="size-3.5" /> {tEnum("experience_level", c.experience_level)}
            </p>
          ) : null}
        </div>
      </div>

      {item.cover_message ? <p className="mt-3 line-clamp-2 text-sm text-foreground/80">{item.cover_message}</p> : <p className="mt-3 text-sm text-muted-foreground">{t("applications.pipeline.no_cover")}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ApplicationStatusBadge status={item.status} label={item.status === "sent" ? t("applications.pipeline.filter_sent") : undefined} />
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3.5" />
          {t("applications.pipeline.applied_at", { time: formatRelative(item.created_at, locale) })}
        </span>
      </div>

      {sheet ? <StatusSheet key={sheet} status={sheet} open onOpenChange={(o) => !o && setSheet(null)} onSubmit={(note) => run(sheet, note)} pending={pending} /> : null}
    </article>
  );
}
