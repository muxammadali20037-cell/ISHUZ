"use client";

import Link from "next/link";
import { MapPin, Clock, CalendarDays, FileCheck2, Utensils, BadgeCheck, Bookmark, Wifi, Landmark } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatRelative, formatWorkTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database.types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MatchScore } from "./match-score";
import { SalaryText } from "./salary-text";

/** search_vacancies RPC qatori bilan mos (kerakli maydonlar) */
export interface VacancyCardData {
  id: string;
  slug: string;
  title: string;
  company_name: string | null;
  company_logo_url: string | null;
  company_verified: boolean | null;
  region_name_uz: string | null;
  region_name_ru: string | null;
  district_name_uz: string | null;
  district_name_ru: string | null;
  is_remote: boolean;
  salary_from: number | null;
  salary_to: number | null;
  salary_type: Enums<"salary_type">;
  salary_negotiable: boolean;
  employment_type: Enums<"employment_type">;
  schedule: Enums<"work_schedule">;
  work_time_from: string | null;
  work_time_to: string | null;
  work_format: Enums<"work_format">;
  benefits: string[] | null;
  published_at: string | null;
  match_score: number | null;
  is_saved: boolean | null;
  has_applied: boolean | null;
  is_featured?: boolean | null;
  /** Tasdiqlangan davlat tashkiloti vakansiyasi */
  is_government?: boolean | null;
}

export function VacancyCard({
  vacancy: v,
  onToggleSave,
  saving,
  className,
  hideMatch,
}: {
  vacancy: VacancyCardData;
  onToggleSave?: (id: string, next: boolean) => void;
  saving?: boolean;
  className?: string;
  hideMatch?: boolean;
}) {
  const { t, tEnum, locale } = useT();
  const region = locale === "ru" ? v.region_name_ru : v.region_name_uz;
  const district = locale === "ru" ? v.district_name_ru : v.district_name_uz;
  const location = v.is_remote ? t("enums.employment_type.remote") : [district, region].filter(Boolean).join(", ");
  const time = v.work_time_from && v.work_time_to ? `${formatWorkTime(v.work_time_from)}–${formatWorkTime(v.work_time_to)}` : null;

  return (
    <article className={cn("relative rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-shadow hover:shadow-md", v.is_featured && "border-primary/40", className)}>
      <Link href={`/jobs/${v.slug}`} className="absolute inset-0 rounded-2xl" aria-label={v.title} />
      <div className="flex items-start gap-3">
        <Avatar src={v.company_logo_url} fallback={(v.company_name ?? v.title).slice(0, 2)} square size="lg" alt="" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-base font-semibold leading-snug">{v.title}</h3>
            {!hideMatch ? <MatchScore score={v.match_score} /> : null}
          </div>
          <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted-foreground">
            {v.company_name ?? t("common.role.employer")}
            {v.company_verified ? <BadgeCheck className="size-4 shrink-0 text-primary" aria-label={t("common.labels.verified")} /> : null}
          </p>
          {v.is_government ? (
            <Badge variant="primary" size="sm" className="mt-1 gap-1">
              <Landmark className="size-3.5" /> {t("jobs.government.badge")}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-3">
        <SalaryText from={v.salary_from} to={v.salary_to} type={v.salary_type} negotiable={v.salary_negotiable} className="text-[15px]" />
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {location ? (
          <span className="inline-flex items-center gap-1">
            {v.is_remote ? <Wifi className="size-4" /> : <MapPin className="size-4" />}
            {location}
          </span>
        ) : null}
        {time ? (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-4" /> {time}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="size-4" /> {tEnum("work_schedule", v.schedule)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge variant={v.work_format === "official" ? "primary" : "default"}>
          <FileCheck2 /> {tEnum("work_format", v.work_format)}
        </Badge>
        <Badge>{tEnum("employment_type", v.employment_type)}</Badge>
        {v.benefits?.includes("food") ? (
          <Badge variant="success">
            <Utensils /> {t("enums.benefit_food")}
          </Badge>
        ) : null}
        {v.has_applied ? <Badge variant="success">{t("enums.application_status.sent")}</Badge> : null}
        <span className="ml-auto text-xs text-muted-foreground">{formatRelative(v.published_at, locale)}</span>
      </div>

      {onToggleSave ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute right-2 top-2 z-10"
          aria-pressed={!!v.is_saved}
          aria-label={t("common.nav.saved")}
          disabled={saving}
          onClick={(e) => {
            e.preventDefault();
            onToggleSave(v.id, !v.is_saved);
          }}
        >
          <Bookmark className={cn("size-5", v.is_saved && "fill-primary text-primary")} />
        </Button>
      ) : null}
    </article>
  );
}
