import Link from "next/link";
import type { ReactNode } from "react";
import { Building2, Clock, ExternalLink, GraduationCap, Images, Languages as LanguagesIcon, MapPin, Pencil, Plus, Wallet } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatMoney, formatWorkTime } from "@/lib/format";
import { getBenefits } from "@/lib/reference";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatExperienceRange, formatYearRange } from "../pure";
import type { WorkerProfileFull } from "../queries";
import { MediaThumb } from "./media-thumb";

/** Bo'lim kartasi: sarlavha + tahrirlash havolasi + kontent yoki bo'sh holat */
export async function SectionCard({
  title,
  editHref,
  empty,
  isEmpty,
  children,
  id,
  icon: Icon,
}: {
  title: string;
  editHref: string;
  empty?: string;
  isEmpty?: boolean;
  children?: ReactNode;
  id?: string;
  icon?: typeof MapPin;
}) {
  const { t } = await getT();
  return (
    <Card id={id} className="scroll-mt-20">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            {Icon ? <Icon className="size-4.5 text-primary" /> : null}
            {title}
          </h2>
          <Link href={editHref} className="-mr-2 flex size-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label={t("profile.view.edit_section")}>
            {isEmpty ? <Plus className="size-5" /> : <Pencil className="size-4.5" />}
          </Link>
        </div>
        {isEmpty ? (
          <Link href={editHref} className="block rounded-xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground">
            {empty}
          </Link>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export async function AboutSection({ data }: { data: WorkerProfileFull }) {
  const { t } = await getT();
  return (
    <SectionCard title={t("profile.sections.about")} editHref="/profile/edit#about" isEmpty={!data.worker.about} empty={t("profile.empty.about")}>
      <p className="whitespace-pre-line text-[15px] leading-relaxed">{data.worker.about}</p>
    </SectionCard>
  );
}

export async function LocationSection({ data }: { data: WorkerProfileFull }) {
  const { t, tEnum, name } = await getT();
  const w = data.worker;
  const isEmpty = !w.region_id && data.locations.length === 0;
  return (
    <SectionCard title={t("profile.sections.location")} editHref="/profile/edit#location" isEmpty={isEmpty} empty={t("profile.empty.location")} icon={MapPin}>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <Row label={t("profile.labels.region")}>{[name(w.region), name(w.district)].filter(Boolean).join(", ") || t("common.labels.not_specified")}</Row>
        {w.area_hint ? <Row label={t("profile.labels.area_hint")}>{w.area_hint}</Row> : null}
        <Row label={t("profile.labels.remote")}>{tEnum("remote_preference", w.remote_preference)}</Row>
        {data.locations.length ? (
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">{t("profile.labels.work_districts")}</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {data.locations.map((l) => (
                <Badge key={l.district_id} variant="outline">
                  {name(l.district)}
                </Badge>
              ))}
            </dd>
          </div>
        ) : null}
      </dl>
    </SectionCard>
  );
}

export async function ExperienceSection({ data }: { data: WorkerProfileFull }) {
  const { t, locale } = await getT();
  return (
    <SectionCard title={t("profile.sections.experience")} editHref="/profile/edit#experience" isEmpty={data.experience.length === 0} empty={t("profile.empty.experience")} icon={Building2}>
      <ol className="relative space-y-5 border-l border-border pl-5">
        {data.experience.map((e) => (
          <li key={e.id} className="relative">
            <span className={cn("absolute -left-[26px] top-1.5 size-2.5 rounded-full ring-4 ring-card", e.is_current ? "bg-primary" : "bg-border")} />
            <p className="font-semibold">{e.position}</p>
            <p className="text-sm text-muted-foreground">{e.company_name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{formatExperienceRange(e.started_on, e.ended_on, e.is_current, locale, t("profile.labels.present"))}</p>
            {e.responsibilities ? <p className="mt-2 whitespace-pre-line text-sm">{e.responsibilities}</p> : null}
            {e.achievements ? <p className="mt-1 whitespace-pre-line text-sm text-success">{e.achievements}</p> : null}
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}

export async function SkillsSection({ data }: { data: WorkerProfileFull }) {
  const { t, tEnum, name } = await getT();
  return (
    <SectionCard title={t("profile.sections.skills")} editHref="/profile/edit#skills" isEmpty={data.skills.length === 0} empty={t("profile.empty.skills")}>
      <div className="flex flex-wrap gap-2">
        {data.skills.map((s) => (
          <span key={s.skill_id} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-secondary pl-3 pr-1.5 text-sm font-medium">
            {name(s.skill)}
            <Badge variant="primary" size="sm">
              {tEnum("skill_level", s.level)}
            </Badge>
          </span>
        ))}
      </div>
    </SectionCard>
  );
}

export async function LanguagesSection({ data }: { data: WorkerProfileFull }) {
  const { t, tEnum, name } = await getT();
  return (
    <SectionCard title={t("profile.sections.languages")} editHref="/profile/edit#languages" isEmpty={data.languages.length === 0} empty={t("profile.empty.languages")} icon={LanguagesIcon}>
      <ul className="divide-y divide-border">
        {data.languages.map((l) => (
          <li key={l.language_code} className="flex items-center justify-between py-2 text-sm">
            <span className="font-medium">{name(l.language) || l.language_code}</span>
            <span className="text-muted-foreground">{tEnum("language_level", l.level)}</span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

export async function EducationSection({ data }: { data: WorkerProfileFull }) {
  const { t, tEnum } = await getT();
  return (
    <SectionCard title={t("profile.sections.education")} editHref="/profile/edit#education" isEmpty={data.education.length === 0} empty={t("profile.empty.education")} icon={GraduationCap}>
      <ul className="space-y-3">
        {data.education.map((e) => (
          <li key={e.id}>
            <p className="font-semibold">{e.institution || tEnum("education_level", e.level)}</p>
            <p className="text-sm text-muted-foreground">{[tEnum("education_level", e.level), e.field].filter(Boolean).join(" · ")}</p>
            {formatYearRange(e.started_year, e.ended_year) ? <p className="mt-0.5 text-xs text-muted-foreground">{formatYearRange(e.started_year, e.ended_year)}</p> : null}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

export async function PortfolioSection({ data }: { data: WorkerProfileFull }) {
  const { t, tEnum } = await getT();
  return (
    <SectionCard title={t("profile.sections.portfolio")} editHref="/profile/portfolio" isEmpty={data.portfolio.length === 0} empty={t("profile.empty.portfolio")} icon={Images}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {data.portfolio.slice(0, 6).map((item) => {
          const first = item.media[0];
          return (
            <Link key={item.id} href="/profile/portfolio" className="group overflow-hidden rounded-xl border border-border bg-secondary/40">
              <div className="aspect-[4/3] overflow-hidden bg-secondary">
                {first ? (
                  <MediaThumb path={first.path} url={first.url} alt={item.title} className="transition-transform group-hover:scale-[1.02]" />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <ExternalLink className="size-7" />
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{tEnum("portfolio_type", item.type)}</p>
              </div>
            </Link>
          );
        })}
      </div>
      {data.portfolio.length > 6 ? (
        <Link href="/profile/portfolio" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
          {t("profile.portfolio.view_all")} ({data.portfolio.length})
        </Link>
      ) : null}
    </SectionCard>
  );
}

export async function PreferencesSection({ data }: { data: WorkerProfileFull }) {
  const { t, tEnum, name, locale } = await getT();
  const pr = data.preferences;
  const w = data.worker;
  const terms = pr?.official_terms.length ? await getBenefits("official_term") : [];
  const termName = (code: string) => name(terms.find((b) => b.code === code)) || code;
  const isEmpty = !pr || (pr.salary_expected === null && pr.salary_min === null && pr.employment_types.length === 0 && pr.schedules.length === 0);
  return (
    <SectionCard title={t("profile.sections.preferences")} editHref="/profile/edit#preferences" isEmpty={isEmpty} empty={t("profile.empty.preferences")} icon={Wallet}>
      {pr ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Row label={t("profile.labels.salary_expected")}>
            {pr.salary_expected !== null ? (
              <span className="font-semibold tabular">
                {formatMoney(pr.salary_expected, locale)} <span className="font-normal text-muted-foreground">{tEnum("salary_type_suffix", pr.salary_type)}</span>
              </span>
            ) : (
              t("common.labels.negotiable")
            )}
          </Row>
          <Row label={t("profile.labels.salary_min")}>{pr.salary_min !== null ? <span className="tabular">{formatMoney(pr.salary_min, locale)}</span> : t("common.labels.not_specified")}</Row>
          <Row label={t("profile.labels.employment_types")}>
            {pr.employment_types.length ? <Chips items={pr.employment_types.map((v) => tEnum("employment_type", v))} /> : t("common.labels.any")}
          </Row>
          <Row label={t("profile.labels.schedules")}>{pr.schedules.length ? <Chips items={pr.schedules.map((v) => tEnum("work_schedule", v))} /> : t("common.labels.any")}</Row>
          {pr.work_time_from || pr.work_time_to ? (
            <Row label={t("profile.labels.work_hours")}>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4 text-muted-foreground" />
                {formatWorkTime(pr.work_time_from) || "…"} – {formatWorkTime(pr.work_time_to) || "…"}
              </span>
            </Row>
          ) : null}
          <Row label={t("profile.labels.availability")}>{tEnum("availability", pr.availability)}</Row>
          <Row label={t("profile.labels.work_format")}>{tEnum("work_format", w.work_format)}</Row>
          {pr.official_terms.length ? (
            <Row label={t("profile.labels.official_terms")}>
              <Chips items={pr.official_terms.map(termName)} />
            </Row>
          ) : null}
        </dl>
      ) : null}
    </SectionCard>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <Badge key={i} variant="outline">
          {i}
        </Badge>
      ))}
    </span>
  );
}
