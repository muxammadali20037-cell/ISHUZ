"use client";

import Link from "next/link";
import { MapPin, Briefcase, Clock, Bookmark, Images, ShieldCheck } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatMoneyShort, formatDistance, shortName, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database.types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MatchScore } from "./match-score";

/** search_workers RPC qatori bilan mos */
export interface WorkerCardData {
  id: string;
  first_name: string;
  last_initial: string | null;
  avatar_url: string | null;
  headline: string | null;
  category_name_uz: string | null;
  category_name_ru: string | null;
  region_name_uz: string | null;
  region_name_ru: string | null;
  district_name_uz: string | null;
  district_name_ru: string | null;
  experience_level: Enums<"experience_level">;
  status: Enums<"worker_status">;
  salary_min: number | null;
  salary_expected: number | null;
  employment_types: Enums<"employment_type">[] | null;
  skills: { id: string; name_uz: string; name_ru: string; level: string }[] | null;
  languages: { code: string; level: string }[] | null;
  has_portfolio: boolean | null;
  phone_verified: boolean | null;
  match_score: number | null;
  distance_km: number | null;
  is_saved: boolean | null;
}

const statusDot: Record<Enums<"worker_status">, string> = { active: "bg-success", open: "bg-warning", not_looking: "bg-muted-foreground" };

export function WorkerCard({
  worker: w,
  onToggleSave,
  saving,
  className,
  hideMatch,
  href,
}: {
  worker: WorkerCardData;
  onToggleSave?: (id: string, next: boolean) => void;
  saving?: boolean;
  className?: string;
  hideMatch?: boolean;
  href?: string;
}) {
  const { t, tEnum, locale, name } = useT();
  const region = locale === "ru" ? w.region_name_ru : w.region_name_uz;
  const district = locale === "ru" ? w.district_name_ru : w.district_name_uz;
  const location = [district, region].filter(Boolean).join(", ");
  const salary = w.salary_min || w.salary_expected ? [w.salary_min, w.salary_expected].filter(Boolean).map((n) => formatMoneyShort(n, locale)).join("–") : null;
  const skills = (w.skills ?? []).slice(0, 4);
  const langs = (w.languages ?? []).filter((l) => l.code !== "uz").slice(0, 2);
  const link = href ?? `/workers/${w.id}`;

  return (
    <article className={cn("relative rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-shadow hover:shadow-md", className)}>
      <Link href={link} className="absolute inset-0 rounded-2xl" aria-label={shortName(w.first_name, w.last_initial)} />
      <div className="flex items-start gap-3">
        <Avatar src={w.avatar_url} fallback={initials(w.first_name, w.last_initial)} size="lg" alt="" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-base font-semibold">{shortName(w.first_name, w.last_initial)}</h3>
            {!hideMatch ? <MatchScore score={w.match_score} /> : null}
          </div>
          <p className="truncate text-sm text-foreground/90">{w.headline ?? name({ name_uz: w.category_name_uz ?? "", name_ru: w.category_name_ru ?? "" })}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {location ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-4" /> {location}
            {w.distance_km !== null && w.distance_km !== undefined ? <span className="text-xs">· {formatDistance(w.distance_km, locale)}</span> : null}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <Briefcase className="size-4" /> {tEnum("experience_level", w.experience_level)}
        </span>
        {salary ? <span className="inline-flex items-center gap-1 font-medium text-foreground">💰 {salary}</span> : null}
        {w.employment_types?.[0] ? (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-4" /> {tEnum("employment_type", w.employment_types[0])}
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-xs">
        <span className={cn("size-2 rounded-full", statusDot[w.status])} />
        <span className="text-muted-foreground">{tEnum("worker_status_short", w.status)}</span>
        {w.phone_verified ? <ShieldCheck className="ml-1 size-3.5 text-primary" aria-label={t("common.labels.verified")} /> : null}
        {w.has_portfolio ? <Images className="size-3.5 text-muted-foreground" aria-label={t("enums.portfolio_type.image")} /> : null}
      </div>

      {skills.length || langs.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {skills.map((s) => (
            <Badge key={s.id} variant="default">
              {name(s)}
            </Badge>
          ))}
          {langs.map((l) => (
            <Badge key={l.code} variant="outline">
              {tEnum("language_code", l.code)} · {l.level.toUpperCase()}
            </Badge>
          ))}
        </div>
      ) : null}

      {onToggleSave ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute right-2 top-2 z-10"
          aria-pressed={!!w.is_saved}
          aria-label={t("common.nav.saved")}
          disabled={saving}
          onClick={(e) => {
            e.preventDefault();
            onToggleSave(w.id, !w.is_saved);
          }}
        >
          <Bookmark className={cn("size-5", w.is_saved && "fill-primary text-primary")} />
        </Button>
      ) : null}
    </article>
  );
}
