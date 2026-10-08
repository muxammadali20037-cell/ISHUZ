import { Suspense } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Briefcase,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Gift,
  GraduationCap,
  Languages,
  MapPin,
  Settings2,
  Sparkles,
  UserRound,
  Users,
  Wifi,
  Landmark,
  type LucideIcon,
} from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { formatRelative, formatWorkTime } from "@/lib/format";
import type { SessionContext } from "@/features/auth/session";
import { EmployerCallCard } from "@/features/contacts/employer-call-card";
import { ReportDialog } from "@/features/reports/report-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MatchReasons, MatchRing } from "@/components/shared/match-score";
import { SalaryText } from "@/components/shared/salary-text";
import { descriptionExcerpt } from "../description";
import type { VacancyDetail as VacancyDetailData, VacancyViewerState } from "../types";
import { SimilarVacancies } from "./similar-vacancies";
import { HomeSectionSkeleton } from "./skeletons";
import { VacancyActions } from "./vacancy-actions";
import { VacancyDescription } from "./vacancy-description";

const EXPERIENCE_PRESETS = [60, 36, 24, 12, 6, 0] as const;

function Section({ title, icon: Icon, children, className }: { title: string; icon?: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5 ${className ?? ""}`}>
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
        {Icon ? <Icon className="size-4.5 text-primary" /> : null}
        {title}
      </h2>
      {children}
    </section>
  );
}

function InfoItem({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-[15px] font-medium leading-snug">{children}</div>
      </div>
    </div>
  );
}

/** /jobs/[slug] to'liq sahifa (server). Ko'ruvchi holati serverda hisoblangan. */
export async function VacancyDetail({
  vacancy: v,
  viewer,
  session,
}: {
  vacancy: VacancyDetailData;
  viewer: VacancyViewerState;
  session: SessionContext | null;
}) {
  const { t, tEnum, locale, name } = await getT();
  const company = v.company;
  const companyName = company?.name ?? t("common.role.employer");
  const isManager = viewer.kind === "manager";
  const time = v.work_time_from && v.work_time_to ? `${formatWorkTime(v.work_time_from)}–${formatWorkTime(v.work_time_to)}` : null;
  const experienceKey = EXPERIENCE_PRESETS.find((p) => v.experience_min_months >= p) ?? 0;
  const age =
    v.age_min && v.age_max
      ? t("jobs.detail.age_range", { min: v.age_min, max: v.age_max })
      : v.age_min
        ? t("jobs.detail.age_from", { min: v.age_min })
        : v.age_max
          ? t("jobs.detail.age_to", { max: v.age_max })
          : null;
  const locationText = [name(v.district), name(v.region)].filter(Boolean).join(", ");
  const mapHref = v.lat !== null && v.lng !== null ? `https://yandex.uz/maps/?pt=${v.lng},${v.lat}&z=16` : null;
  const requiredSkills = v.skills.filter((s) => s.is_required);
  const niceSkills = v.skills.filter((s) => !s.is_required);
  const contactProfileId = session && !isManager ? v.owner_profile_id : null;
  // E'londagi aloqa raqami: ish beruvchi rozilik bergan bo'lsa — hammaga (mehmonga ham); rad etgan bo'lsa — ko'rsatilmaydi
  const supabase = await createClient();
  const { data: adPhone } = isManager ? { data: null } : await supabase.rpc("simple_vacancy_phone", { p_vacancy_id: v.id });
  const showContact = !isManager && (!!adPhone || !!contactProfileId);

  return (
    <div className="container-app pb-24 pt-4 sm:pt-6 lg:pb-8">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link
          href="/jobs"
          className="-ml-1 inline-flex min-h-12 items-center gap-1 rounded-lg px-2 text-base font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ChevronLeft className="size-5" /> {t("jobs.detail.back")}
        </Link>
        {isManager ? (
          <Button asChild variant="soft" size="sm">
            <Link href={`/employer/vacancies/${v.id}`}>
              <Settings2 className="size-4" /> {t("jobs.detail.manage")}
            </Link>
          </Button>
        ) : (
          <ReportDialog targetType="vacancy" targetId={v.id} iconOnly />
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
        <div className="min-w-0 space-y-4">
          {/* Sarlavha kartasi */}
          <header className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
            <div className="flex items-start gap-4">
              <Avatar src={company?.logo_url} fallback={companyName.slice(0, 2)} square size="xl" alt="" className="size-16 sm:size-20" />
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold leading-tight sm:text-2xl">{v.title}</h1>
                {v.is_government ? (
                  <Link href="/jobs?gov=1" className="mt-1.5 inline-flex">
                    <Badge variant="primary" className="gap-1">
                      <Landmark className="size-3.5" /> {t("jobs.government.badge")}
                    </Badge>
                  </Link>
                ) : null}
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  {company ? (
                    <Link
                      href={`/company/${company.slug}`}
                      className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {company.name}
                      {company.verification_status === "verified" ? (
                        <BadgeCheck className="size-4 text-primary" aria-label={t("jobs.detail.company_verified")} />
                      ) : null}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">{companyName}</span>
                  )}
                  {v.category ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <span aria-hidden>·</span>
                      <Link href={`/jobs?category=${v.category.slug}`} className="hover:underline">
                        {name(v.category)}
                      </Link>
                      {v.subcategory ? (
                        <>
                          <ChevronRight className="size-3.5" />
                          <Link href={`/jobs?category=${v.category.slug}&subcategory=${v.subcategory.slug}`} className="hover:underline">
                            {name(v.subcategory)}
                          </Link>
                        </>
                      ) : null}
                      {v.profession && (!v.subcategory || name(v.profession) !== name(v.subcategory)) ? (
                        <>
                          <ChevronRight className="size-3.5" />
                          <span className="font-medium text-foreground">{name(v.profession)}</span>
                        </>
                      ) : null}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <SalaryText from={v.salary_from} to={v.salary_to} type={v.salary_type} negotiable={v.salary_negotiable} className="text-xl sm:text-2xl" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              {v.published_at ? (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-4" /> {t("jobs.detail.published", { time: formatRelative(v.published_at, locale) })}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <Eye className="size-4" /> {t("jobs.detail.views", { count: v.views_count })}
              </span>
              {v.applications_count > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Users className="size-4" /> {t("jobs.detail.applications_count", { count: v.applications_count })}
                </span>
              ) : null}
              {v.status !== "active" ? (
                <Badge variant="warning" size="lg">
                  {tEnum("vacancy_status", v.status)}
                </Badge>
              ) : null}
            </div>
            {v.status !== "active" && !isManager ? (
              <p className="mt-3 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">{t("jobs.detail.status_inactive")}</p>
            ) : null}
          </header>

          {/* Moslik */}
          {viewer.match ? (
            <Section title={t("jobs.detail.match_title")} icon={Sparkles}>
              <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
                <MatchRing score={viewer.match.score} />
                <MatchReasons reasons={viewer.match.reasons} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{t("jobs.detail.match_hint")}</p>
            </Section>
          ) : null}

          {/* Asosiy ma'lumotlar */}
          <Section title={t("jobs.detail.info")} icon={Briefcase}>
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoItem icon={v.is_remote ? Wifi : MapPin} label={t("jobs.detail.location")}>
                {v.is_remote ? (
                  <span>
                    {t("jobs.detail.remote")}
                    {locationText ? ` · ${locationText}` : ""}
                  </span>
                ) : (
                  <>
                    <span>{locationText || t("common.labels.not_specified")}</span>
                    {v.address ? <span className="block text-sm font-normal text-muted-foreground">{v.address}</span> : null}
                  </>
                )}
                {mapHref ? (
                  <a
                    href={mapHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    {t("jobs.detail.map")} <ExternalLink className="size-3.5" />
                  </a>
                ) : null}
              </InfoItem>
              <InfoItem icon={CalendarDays} label={t("jobs.detail.schedule")}>
                {tEnum("work_schedule", v.schedule)}
                {time ? (
                  <span className="ml-2 inline-flex items-center gap-1 text-sm font-normal text-muted-foreground">
                    <Clock className="size-3.5" /> {time}
                  </span>
                ) : null}
              </InfoItem>
              <InfoItem icon={Briefcase} label={t("jobs.detail.employment")}>
                {tEnum("employment_type", v.employment_type)}
              </InfoItem>
              {v.opportunity_type !== "job" ? (
                <InfoItem icon={GraduationCap} label={t("jobs.filters.opportunity")}>
                  {tEnum("opportunity_type", v.opportunity_type)}
                  {v.is_paid === false ? <span className="ml-2 text-sm font-normal text-warning">· {t("jobs.card.unpaid")}</span> : v.is_paid ? <span className="ml-2 text-sm font-normal text-muted-foreground">· {t("vacancies.wizard.schedule.paid_yes")}</span> : null}
                </InfoItem>
              ) : null}
              <InfoItem icon={FileText} label={t("jobs.detail.experience")}>
                {tEnum("experience_min_months", String(experienceKey))}
              </InfoItem>
              {v.positions_count > 1 ? (
                <InfoItem icon={Users} label={t("jobs.detail.positions")}>
                  {t("vacancies.preview.positions", { count: v.positions_count })}
                </InfoItem>
              ) : null}
              {v.education_min ? (
                <InfoItem icon={GraduationCap} label={t("jobs.detail.education")}>
                  {tEnum("education_level", v.education_min)}
                </InfoItem>
              ) : null}
              {age ? (
                <InfoItem icon={UserRound} label={t("jobs.detail.age")}>
                  {age}
                </InfoItem>
              ) : null}
              {v.gender ? (
                <InfoItem icon={Users} label={t("jobs.detail.gender")}>
                  {tEnum("gender", v.gender)}
                </InfoItem>
              ) : null}
              {v.languages.length ? (
                <InfoItem icon={Languages} label={t("jobs.detail.languages")}>
                  <ul className="space-y-0.5">
                    {v.languages.map((l) => (
                      <li key={l.code}>
                        {name(l)} <span className="text-sm font-normal text-muted-foreground">— {tEnum("language_level", l.min_level)}</span>
                      </li>
                    ))}
                  </ul>
                </InfoItem>
              ) : null}
            </div>
          </Section>

          {/* Ko'nikmalar */}
          {v.skills.length ? (
            <Section title={t("jobs.detail.skills")} icon={Sparkles}>
              <div className="space-y-3">
                {requiredSkills.length ? (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("jobs.detail.skills_required")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {requiredSkills.map((s) => (
                        <Badge key={s.id} variant="primary" size="lg">
                          {name(s)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {niceSkills.length ? (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("jobs.detail.skills_nice")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {niceSkills.map((s) => (
                        <Badge key={s.id} variant="outline" size="lg">
                          {name(s)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </Section>
          ) : null}

          {/* Rasmiylik va imkoniyatlar */}
          <Section title={t("jobs.detail.format")} icon={FileCheck2}>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant={v.work_format === "official" ? "success" : "default"} size="lg">
                <FileCheck2 /> {tEnum("work_format", v.work_format)}
              </Badge>
              {v.officialTerms.map((b) => (
                <Badge key={b.code} variant="success" size="lg">
                  {name(b)}
                </Badge>
              ))}
            </div>
            {v.benefits.length ? (
              <div className="mt-4">
                <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <Gift className="size-3.5" /> {t("jobs.detail.benefits")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {v.benefits.map((b) => (
                    <Badge key={b.code} size="lg">
                      {name(b)}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </Section>

          {/* Tavsif */}
          <Section title={t("jobs.detail.about")} icon={FileText}>
            {v.description?.trim() ? (
              <VacancyDescription text={v.description} />
            ) : (
              <p className="text-sm text-muted-foreground">{t("jobs.detail.no_description")}</p>
            )}
          </Section>

          {/* Kompaniya */}
          {company ? (
            <Section title={t("jobs.detail.company")}>
              <div className="flex items-start gap-3">
                <Avatar src={company.logo_url} fallback={company.name.slice(0, 2)} square size="lg" alt="" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 font-semibold">
                    {company.name}
                    {company.verification_status === "verified" ? (
                      <BadgeCheck className="size-4 text-primary" aria-label={t("jobs.detail.company_verified")} />
                    ) : null}
                  </p>
                  {company.size ? <p className="text-sm text-muted-foreground">{tEnum("company_size", company.size)}</p> : null}
                  {company.about ? <p className="mt-2 text-sm text-foreground/90">{descriptionExcerpt(company.about, 240)}</p> : null}
                  <Link href={`/company/${company.slug}`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                    {t("jobs.detail.company_page")} <ChevronRight className="size-4" />
                  </Link>
                </div>
              </div>
            </Section>
          ) : null}

          {/* Kontakt (mobil: shu yerda; desktop: yon panel) */}
          {showContact ? (
            <div className="lg:hidden">
              <EmployerCallCard phone={adPhone ?? null} companyTelegram={company?.telegram ?? null} ownerProfileId={contactProfileId} />
            </div>
          ) : null}
        </div>

        <aside className="contents lg:block lg:self-start lg:sticky lg:top-20 lg:space-y-4">
          <VacancyActions
            vacancy={{ id: v.id, slug: v.slug, title: v.title, companyName: company?.name ?? null, status: v.status }}
            viewer={{ kind: viewer.kind, isSaved: viewer.isSaved, application: viewer.application }}
          />
          {showContact ? (
            <div className="hidden lg:block">
              <EmployerCallCard phone={adPhone ?? null} companyTelegram={company?.telegram ?? null} ownerProfileId={contactProfileId} />
            </div>
          ) : null}
        </aside>
      </div>

      <Suspense
        fallback={
          <div className="mt-8">
            <HomeSectionSkeleton />
          </div>
        }
      >
        <SimilarVacancies vacancy={v} />
      </Suspense>
    </div>
  );
}
