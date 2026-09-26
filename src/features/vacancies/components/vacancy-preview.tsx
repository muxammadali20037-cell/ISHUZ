"use client";

import { MapPin, Wifi, CalendarDays, Clock, Briefcase, FileCheck2, GraduationCap, Users, Languages, BadgeCheck, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatWorkTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Benefit } from "@/lib/reference";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SalaryText } from "@/components/shared/salary-text";
import type { VacancyFull } from "../types";
import { Description } from "./description";

function Row({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-[15px] font-medium">{children}</div>
      </div>
    </div>
  );
}

/**
 * Vakansiya to'liq ko'rinishi — nomzod ko'radigan e'lon kabi (review va boshqaruv sahifasida).
 */
export function VacancyPreview({ vacancy: v, benefits, className }: { vacancy: VacancyFull; benefits: Benefit[]; className?: string }) {
  const { t, tEnum, name } = useT();
  const location = v.is_remote ? t("vacancies.preview.remote") : [v.district ? name(v.district) : null, v.region ? name(v.region) : null].filter(Boolean).join(", ");
  const time = v.work_time_from && v.work_time_to ? `${formatWorkTime(v.work_time_from)}–${formatWorkTime(v.work_time_to)}` : null;
  const benefitName = (code: string) => {
    const b = benefits.find((x) => x.code === code);
    return b ? name(b) : code;
  };
  const required = v.skills.filter((s) => s.is_required);
  const preferred = v.skills.filter((s) => !s.is_required);
  const age =
    v.age_min && v.age_max
      ? t("vacancies.preview.age_range", { min: v.age_min, max: v.age_max })
      : v.age_min
        ? t("vacancies.preview.age_from", { min: v.age_min })
        : v.age_max
          ? t("vacancies.preview.age_to", { max: v.age_max })
          : null;
  const hasRequirements = v.experience_min_months > 0 || age || v.education_min || v.gender || v.languages.length > 0;

  return (
    <article className={cn("rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-6", className)}>
      <header className="flex items-start gap-3">
        <Avatar src={v.company?.logo_url} fallback={(v.company?.name ?? v.title).slice(0, 2)} square size="lg" alt="" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold leading-snug sm:text-xl">{v.title}</h2>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
            {v.company?.name ?? t("vacancies.preview.employer_person")}
            {v.company?.verification_status === "verified" ? <BadgeCheck className="size-4 text-primary" aria-label={t("common.labels.verified")} /> : null}
          </p>
          <div className="mt-2">
            <SalaryText from={v.salary_from} to={v.salary_to} type={v.salary_type} negotiable={v.salary_negotiable} className="text-base sm:text-lg" />
          </div>
        </div>
      </header>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Badge variant={v.work_format === "official" ? "primary" : "default"}>
          <FileCheck2 /> {tEnum("work_format", v.work_format)}
        </Badge>
        <Badge>{tEnum("employment_type", v.employment_type)}</Badge>
        <Badge>{tEnum("work_schedule", v.schedule)}</Badge>
        {v.is_remote ? (
          <Badge variant="success">
            <Wifi /> {t("vacancies.preview.remote")}
          </Badge>
        ) : null}
      </div>

      <section className="mt-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("vacancies.preview.info")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Row icon={v.is_remote ? Wifi : MapPin} label={t("vacancies.preview.location")}>
            {location || t("common.labels.not_specified")}
            {!v.is_remote && v.address ? <div className="text-sm font-normal text-muted-foreground">{v.address}</div> : null}
          </Row>
          <Row icon={CalendarDays} label={t("vacancies.preview.schedule")}>
            {tEnum("work_schedule", v.schedule)}
          </Row>
          <Row icon={Briefcase} label={t("vacancies.preview.employment")}>
            {tEnum("employment_type", v.employment_type)}
          </Row>
          {time ? (
            <Row icon={Clock} label={t("vacancies.preview.work_time")}>
              {time}
            </Row>
          ) : null}
        </div>
      </section>

      <section className="mt-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("vacancies.preview.requirements")}</h3>
        {hasRequirements ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Row icon={Briefcase} label={t("vacancies.preview.experience")}>
              {tEnum("experience_min_months", String(v.experience_min_months))}
            </Row>
            {age ? (
              <Row icon={Users} label={t("vacancies.preview.age")}>
                {age}
              </Row>
            ) : null}
            {v.education_min ? (
              <Row icon={GraduationCap} label={t("vacancies.preview.education")}>
                {tEnum("education_level", v.education_min)}
              </Row>
            ) : null}
            {v.gender ? (
              <Row icon={Users} label={t("vacancies.preview.gender")}>
                {tEnum("gender", v.gender)}
              </Row>
            ) : null}
            {v.languages.length ? (
              <Row icon={Languages} label={t("vacancies.preview.languages")}>
                <div className="flex flex-wrap gap-1.5">
                  {v.languages.map((l) => (
                    <Badge key={l.language_code} variant="outline">
                      {tEnum("language_code", l.language_code)} · {l.min_level === "native" ? tEnum("language_level", "native") : l.min_level.toUpperCase()}
                    </Badge>
                  ))}
                </div>
              </Row>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("vacancies.preview.no_requirements")}</p>
        )}
      </section>

      {v.skills.length ? (
        <section className="mt-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("vacancies.preview.skills")}</h3>
          {required.length ? (
            <div className="mb-2">
              <div className="mb-1.5 text-xs text-muted-foreground">{t("vacancies.preview.required_skills")}</div>
              <div className="flex flex-wrap gap-1.5">
                {required.map((s) => (
                  <Badge key={s.skill_id} variant="primary" size="lg">
                    {name(s)}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
          {preferred.length ? (
            <div>
              <div className="mb-1.5 text-xs text-muted-foreground">{t("vacancies.preview.preferred_skills")}</div>
              <div className="flex flex-wrap gap-1.5">
                {preferred.map((s) => (
                  <Badge key={s.skill_id} variant="outline" size="lg">
                    {name(s)}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="mt-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("vacancies.preview.description")}</h3>
        {v.description?.trim() ? <Description text={v.description} /> : <p className="text-sm text-muted-foreground">{t("vacancies.preview.no_description")}</p>}
      </section>

      {v.work_format === "official" && v.official_terms.length ? (
        <section className="mt-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("vacancies.preview.official_terms")}</h3>
          <div className="flex flex-wrap gap-1.5">
            {v.official_terms.map((code) => (
              <Badge key={code} variant="primary">
                <FileCheck2 /> {benefitName(code)}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}

      {v.benefits.length ? (
        <section className="mt-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("vacancies.preview.benefits")}</h3>
          <div className="flex flex-wrap gap-1.5">
            {v.benefits.map((code) => (
              <Badge key={code} variant="success">
                <Sparkles /> {benefitName(code)}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
