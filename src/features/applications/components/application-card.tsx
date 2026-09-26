"use client";

import Link from "next/link";
import { BadgeCheck, Clock } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { MatchScore } from "@/components/shared/match-score";
import type { WorkerApplicationItem } from "../types";
import { ApplicationStatusBadge } from "./status-badge";

/** Ishchi ro'yxatidagi ariza kartasi */
export function ApplicationCard({ item, className }: { item: WorkerApplicationItem; className?: string }) {
  const { t, locale } = useT();
  const v = item.vacancy;
  const title = v?.title ?? t("applications.list.vacancy_unavailable");
  const company = v?.company?.name ?? (v ? t("common.role.employer") : "");
  return (
    <article className={cn("relative rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-shadow hover:shadow-md", className)}>
      <Link href={`/applications/${item.id}`} className="absolute inset-0 rounded-2xl" aria-label={title} />
      <div className="flex items-start gap-3">
        <Avatar src={v?.company?.logo_url} fallback={(v?.company?.name ?? v?.title ?? "?").slice(0, 2)} square size="lg" alt="" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className={cn("line-clamp-2 text-base font-semibold leading-snug", !v && "text-muted-foreground")}>{title}</h3>
            <MatchScore score={item.match_score} />
          </div>
          {company ? (
            <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted-foreground">
              {company}
              {v?.company?.verification_status === "verified" ? <BadgeCheck className="size-4 shrink-0 text-primary" aria-label={t("common.labels.verified")} /> : null}
            </p>
          ) : null}
        </div>
      </div>
      <p className="mt-3 text-sm text-foreground/80">{t(`applications.status_hint.${item.status}`)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ApplicationStatusBadge status={item.status} />
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3.5" />
          {t("applications.list.updated", { time: formatRelative(item.updated_at, locale) })}
        </span>
      </div>
    </article>
  );
}
