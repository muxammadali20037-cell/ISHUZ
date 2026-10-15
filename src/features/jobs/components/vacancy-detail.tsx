import { Suspense } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  FileCheck2,
  Gift,
  MapPin,
  Settings2,
  Sparkles,
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
import { vacancyPhotoUrl } from "@/features/post/photo";
import { Photo } from "@/components/shared/photo";
import { BackLink } from "@/components/shared/back-link";

const EXPERIENCE_PRESETS = [60, 36, 24, 12, 6, 0] as const;

function Section({ title, icon: Icon, children, className }: { title: string; icon?: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5 ${className ?? ""}`}>
      <h2 className="mb-2.5 flex items-center gap-2 text-lg font-bold">
        {Icon ? <Icon className="size-4.5 text-primary" aria-hidden /> : null}
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Ixcham fakt (I1): kichik yorliq + qalin qiymat; ikki ustunli to'rda — katta ikonka doiralarisiz */
function Fact({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : "min-w-0"}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="break-words text-base font-semibold leading-snug">{children}</dd>
    </div>
  );
}

function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** Kompaniyasiz ish beruvchining ochiq nomi (`employer_public_names` — faqat kirgan foydalanuvchiga ruxsat) */
async function employerPublicName(ownerId: string, session: SessionContext | null): Promise<string | null> {
  if (!session) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("employer_public_names", { p_profile_ids: [ownerId] });
  return data?.[0]?.display_name?.trim() || null;
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
  // kompaniyasiz ish beruvchi: qidiruv kartasidagi nom (display_name — kirganlarga), mehmonga — ega ismi
  const companyName = company?.name ?? (v.owner_profile_id ? await employerPublicName(v.owner_profile_id, session) : null) ?? (v.owner?.first_name?.trim() || t("common.role.employer"));
  const isManager = viewer.kind === "manager";
  // muddati o'tgan, lekin soatlik vazifa hali yopmagan e'lon ham yopiq ko'rinadi (ariza serverda ham rad etiladi — 0065)
  const status = v.is_expired ? "expired" : v.status;
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

  const hasConditions = v.skills.length > 0 || v.officialTerms.length > 0 || v.benefits.length > 0;
  const contactCard = showContact ? <EmployerCallCard phone={adPhone ?? null} companyTelegram={company?.telegram ?? null} ownerProfileId={contactProfileId} /> : null;

  return (
    <div className="container-app pb-24 pt-3 sm:pt-6 lg:pb-8">
      <div className="mb-2 flex items-center justify-between gap-2">
        {/* qidiruvdan kelgan bo'lsa — o'sha natijalarga (o'sha joyiga) qaytadi */}
        <BackLink
          fallback="/search?mode=jobs"
          className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-base font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ChevronLeft className="size-5" aria-hidden /> {t("easy.wizard.back")}
        </BackLink>
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
        <div className="min-w-0 space-y-3">
          {/* haqiqiy ish joyi surati (egasi yuklagan, moderatsiyadan o'tgan); ochilmasa — joy egallamaydi */}
          <Photo
            src={v.photo_path ? vacancyPhotoUrl(v.photo_path) : null}
            alt={t("easy.photo.alt")}
            sizes="(min-width: 1024px) 640px, 100vw"
            className="aspect-[2/1] w-full rounded-2xl border border-border/70"
            fallback={null}
          >
            <figcaption className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">{t("easy.photo.label")}</figcaption>
          </Photo>

          {/* Sarlavha: nomi → maosh → ish beruvchi → joy → sana (I1: ixcham, eng muhimi birinchi ekranda) */}
          <header className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
            {v.is_government ? (
              <Link href="/jobs?gov=1" className="mb-1.5 inline-flex">
                <Badge variant="primary" className="gap-1">
                  <Landmark className="size-3.5" /> {t("jobs.government.badge")}
                </Badge>
              </Link>
            ) : null}
            <h1 className="break-words text-2xl font-bold leading-tight">{v.title}</h1>
            <SalaryText from={v.salary_from} to={v.salary_to} type={v.salary_type} negotiable={v.salary_negotiable} className="mt-1.5 block text-xl font-extrabold text-primary sm:text-2xl" />
            <div className="mt-3 flex items-center gap-2.5">
              <Avatar src={company?.logo_url} fallback={companyName.slice(0, 2)} square size="md" alt="" className="size-10 shrink-0" />
              <div className="min-w-0">
                {company ? (
                  <Link
                    href={`/company/${company.slug}`}
                    className="inline-flex items-center gap-1 text-base font-semibold text-foreground hover:text-primary hover:underline"
                  >
                    {company.name}
                    {company.verification_status === "verified" ? (
                      <BadgeCheck className="size-4 text-primary" aria-label={t("jobs.detail.company_verified")} />
                    ) : null}
                  </Link>
                ) : (
                  <p className="text-base font-semibold">{companyName}</p>
                )}
                {v.category ? (
                  // bosish maydoni 44 px (tap-target); mt-3 — kengaygan maydon tepadagi kompaniya havolasini yopmasin
                  <p className="mt-3 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                    <Link href={`/jobs?category=${v.category.slug}`} className="tap-target relative hover:underline">
                      {name(v.category)}
                    </Link>
                    {v.profession ? (
                      <>
                        <ChevronRight className="size-3.5" aria-hidden />
                        <span>{name(v.profession)}</span>
                      </>
                    ) : v.subcategory ? (
                      <>
                        <ChevronRight className="size-3.5" aria-hidden />
                        <span>{name(v.subcategory)}</span>
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-base">
              {v.is_remote ? <Wifi className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden /> : <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />}
              <span className="min-w-0">
                {v.is_remote ? `${t("jobs.detail.remote")}${locationText ? ` · ${locationText}` : ""}` : locationText || t("common.labels.not_specified")}
                {v.address && !v.is_remote ? <span className="block text-sm text-muted-foreground">{v.address}</span> : null}
                {mapHref ? (
                  <a href={mapHref} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium text-primary hover:underline">
                    {t("jobs.detail.map")} <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ) : null}
              </span>
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {v.published_at ? (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-4" aria-hidden /> {t("jobs.detail.published", { time: formatRelative(v.published_at, locale) })}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <Eye className="size-4" aria-hidden /> {t("jobs.detail.views", { count: v.views_count })}
              </span>
              {v.applications_count > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Users className="size-4" aria-hidden /> {t("jobs.detail.applications_count", { count: v.applications_count })}
                </span>
              ) : null}
              {status !== "active" ? (
                <Badge variant="warning" size="lg">
                  {tEnum("vacancy_status", status)}
                </Badge>
              ) : null}
            </div>
            {status !== "active" && !isManager ? (
              <p className="mt-3 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">{t("jobs.detail.status_inactive")}</p>
            ) : null}
          </header>

          {/* Asosiy ma'lumotlar — ixcham ikki ustun */}
          <Section title={t("jobs.detail.info")}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Fact label={t("jobs.detail.schedule")}>
                {tEnum("work_schedule", v.schedule)}
                {time ? <span className="block text-sm font-normal text-muted-foreground">{time}</span> : null}
              </Fact>
              <Fact label={t("jobs.detail.employment")}>{tEnum("employment_type", v.employment_type)}</Fact>
              <Fact label={t("jobs.detail.experience")}>{tEnum("experience_min_months", String(experienceKey))}</Fact>
              <Fact label={t("jobs.detail.format")}>
                <span className={v.work_format === "official" ? "text-success" : undefined}>{tEnum("work_format", v.work_format)}</span>
              </Fact>
              {v.opportunity_type !== "job" ? (
                <Fact label={t("jobs.filters.opportunity")}>
                  {tEnum("opportunity_type", v.opportunity_type)}
                  {v.is_paid === false ? <span className="block text-sm font-normal text-warning">{t("jobs.card.unpaid")}</span> : null}
                </Fact>
              ) : null}
              {v.positions_count > 1 ? <Fact label={t("jobs.detail.positions")}>{t("vacancies.preview.positions", { count: v.positions_count })}</Fact> : null}
              {v.education_min ? <Fact label={t("jobs.detail.education")}>{tEnum("education_level", v.education_min)}</Fact> : null}
              {age ? <Fact label={t("jobs.detail.age")}>{age}</Fact> : null}
              {v.gender ? <Fact label={t("jobs.detail.gender")}>{tEnum("gender", v.gender)}</Fact> : null}
              {v.languages.length ? (
                <Fact label={t("jobs.detail.languages")} wide>
                  {v.languages.map((l) => `${name(l)} — ${tEnum("language_level", l.min_level)}`).join(", ")}
                </Fact>
              ) : null}
            </dl>
          </Section>

          {/* Bog'lanish — telefonda tavsifdan oldin (asosiy amal birinchi ekranlarda); kompyuterda — yon panelda */}
          {contactCard ? <div className="lg:hidden">{contactCard}</div> : null}

          {/* Moslik (ish izlovchi profili bo'lsa) */}
          {viewer.match ? (
            <Section title={t("jobs.detail.match_title")} icon={Sparkles}>
              <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
                <MatchRing score={viewer.match.score} />
                <MatchReasons reasons={viewer.match.reasons} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{t("jobs.detail.match_hint")}</p>
            </Section>
          ) : null}

          {/* Tavsif */}
          <Section title={t("jobs.detail.about")}>
            {v.description?.trim() ? (
              <VacancyDescription text={v.description} />
            ) : (
              <p className="text-sm text-muted-foreground">{t("jobs.detail.no_description")}</p>
            )}
          </Section>

          {/* Talablar va qulayliklar: ko'nikmalar, rasmiy shartlar, imkoniyatlar — bitta blokda */}
          {hasConditions ? (
            <Section title={t("jobs.detail.conditions")}>
              <div className="space-y-3">
                {requiredSkills.length ? (
                  <ChipGroup label={t("jobs.detail.skills_required")}>
                    {requiredSkills.map((s) => (
                      <Badge key={s.id} variant="primary" size="lg">
                        {name(s)}
                      </Badge>
                    ))}
                  </ChipGroup>
                ) : null}
                {niceSkills.length ? (
                  <ChipGroup label={t("jobs.detail.skills_nice")}>
                    {niceSkills.map((s) => (
                      <Badge key={s.id} variant="outline" size="lg">
                        {name(s)}
                      </Badge>
                    ))}
                  </ChipGroup>
                ) : null}
                {v.officialTerms.length ? (
                  <ChipGroup label={tEnum("work_format", v.work_format)}>
                    {v.officialTerms.map((b) => (
                      <Badge key={b.code} variant="success" size="lg">
                        <FileCheck2 /> {name(b)}
                      </Badge>
                    ))}
                  </ChipGroup>
                ) : null}
                {v.benefits.length ? (
                  <ChipGroup label={t("jobs.detail.benefits")}>
                    {v.benefits.map((b) => (
                      <Badge key={b.code} size="lg">
                        <Gift /> {name(b)}
                      </Badge>
                    ))}
                  </ChipGroup>
                ) : null}
              </div>
            </Section>
          ) : null}

          {/* Kompaniya — ixcham */}
          {company ? (
            <Section title={t("jobs.detail.company")}>
              <div className="flex items-start gap-3">
                <Avatar src={company.logo_url} fallback={company.name.slice(0, 2)} square size="md" alt="" className="size-10 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 font-semibold">
                    {company.name}
                    {company.verification_status === "verified" ? (
                      <BadgeCheck className="size-4 text-primary" aria-label={t("jobs.detail.company_verified")} />
                    ) : null}
                  </p>
                  {company.size ? <p className="text-sm text-muted-foreground">{tEnum("company_size", company.size)}</p> : null}
                  {company.about ? <p className="mt-1.5 line-clamp-3 text-sm text-foreground/90">{descriptionExcerpt(company.about, 240)}</p> : null}
                  <Link href={`/company/${company.slug}`} className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline">
                    {t("jobs.detail.company_page")} <ChevronRight className="size-4" aria-hidden />
                  </Link>
                </div>
              </div>
            </Section>
          ) : null}
        </div>

        <aside className="contents lg:block lg:self-start lg:sticky lg:top-20 lg:space-y-4">
          <VacancyActions
            vacancy={{ id: v.id, slug: v.slug, title: v.title, companyName: company?.name ?? null, status }}
            viewer={{ kind: viewer.kind, isSaved: viewer.isSaved, application: viewer.application, quickApply: viewer.quickApply }}
          />
          {contactCard ? <div className="hidden lg:block">{contactCard}</div> : null}
        </aside>
      </div>

      <Suspense
        fallback={
          <div className="mt-6">
            <HomeSectionSkeleton />
          </div>
        }
      >
        <SimilarVacancies vacancy={v} />
      </Suspense>
    </div>
  );
}
