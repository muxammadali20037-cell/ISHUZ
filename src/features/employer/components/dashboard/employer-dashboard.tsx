import { Suspense } from "react";
import { CoachTour } from "@/components/shared/coach-tour";
import Link from "next/link";
import { Building2, ChevronRight, Plus, PlusCircle, Search, ShieldCheck } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getCategories } from "@/lib/reference";
import { initials } from "@/lib/format";
import type { SessionContext } from "@/features/auth/session";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/misc";
import { employerDisplayName } from "../../mappers";
import { getCompanyById, getEmployerProfile, getLatestVacancy, getMyVacancies } from "../../queries";
import { CandidatesSection } from "./candidates-section";
import { MyVacanciesSection } from "./my-vacancies-section";
import { RecentApplicationsSection } from "./recent-applications-section";
import { CardsSectionSkeleton, RowsSectionSkeleton, StatsSkeleton } from "./skeletons";
import { KeyTiles } from "./stats-tiles";
import { EmployerSections } from "./employer-sections";
import { VerificationBadge } from "./status-badge";

/**
 * /employer dashboard (server). Har bo'lim Suspense'da; bo'sh bo'lim ko'rinmaydi.
 */
export async function EmployerDashboard({ session }: { session: SessionContext & { employerId: string } }) {
  const { t, tEnum } = await getT();
  const { userId, companyId } = session;
  const [profile, company, latestActive, latestAny, anyVacancy] = await Promise.all([
    getEmployerProfile(userId),
    companyId ? getCompanyById(companyId) : Promise.resolve(null),
    getLatestVacancy(userId, companyId, true),
    getLatestVacancy(userId, companyId, false),
    getMyVacancies(userId, companyId, 1),
  ]);

  const name = employerDisplayName({ companyName: company?.name, displayName: profile?.display_name, firstName: session.profile.first_name });
  const verification = company?.verification_status ?? profile?.verification_status ?? "unverified";
  const logoUrl = company?.logo_url ?? null;
  const hasVacancies = anyVacancy.length > 0;

  // /workers havolalari slug bilan ishlaydi
  const categories = await getCategories();
  const categorySlug = (id: string | null | undefined) => categories.find((c) => c.id === id)?.slug ?? null;
  const latestCategoryId = latestActive?.category_id ?? latestAny?.category_id ?? null;
  const latestCategorySlug = categorySlug(latestCategoryId);
  const withCategory = (base: string) => (latestCategorySlug ? `${base}&category=${latestCategorySlug}` : base);

  const candidatesHref = latestActive ? withCategory(`/workers?vacancy=${latestActive.id}&sort=relevant`) : "/workers";

  return (
    <div className="container-app space-y-6 py-5 sm:py-8">
      <CoachTour role="employer" />
      {/* Salomlashuv */}
      <header className="flex items-center gap-3">
        {company ? (
          <Avatar src={logoUrl} fallback={initials(name)} square size="lg" alt="" className="border border-border/70" />
        ) : (
          <Avatar src={session.profile.avatar_url} fallback={initials(session.profile.first_name, session.profile.last_name)} size="lg" alt="" />
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">{t("employer.dashboard.greeting", { name })}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <VerificationBadge status={verification} label={tEnum("verification_status", verification)} />
            {verification === "unverified" || verification === "rejected" ? (
              <Link href="/company/settings#verification" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                <ShieldCheck className="size-4" /> {t("employer.dashboard.verify_cta")}
              </Link>
            ) : null}
            {company ? (
              <Link href={`/company/${company.slug}`} className="hidden items-center gap-1 text-sm text-muted-foreground hover:text-foreground sm:inline-flex">
                <Building2 className="size-4" /> {t("employer.settings.public_page")}
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      {/* Asosiy harakat — bitta, katta */}
      <Link
        href="/employer/vacancies/new"
        data-tour="employer-post"
        className="group flex items-center gap-4 rounded-3xl bg-primary p-5 text-primary-foreground shadow-md transition-transform hover:-translate-y-0.5 sm:p-7"
      >
        <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 sm:size-20">
          <Plus className="size-9 sm:size-11" strokeWidth={2.5} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xl font-extrabold uppercase tracking-tight sm:text-2xl">{t("employer.dashboard.post_vacancy_big")}</span>
          <span className="mt-1 block text-sm text-primary-foreground/80 sm:text-base">{t("employer.dashboard.post_vacancy_hint")}</span>
        </span>
        <ChevronRight className="size-7 shrink-0 transition-transform group-hover:translate-x-1" />
      </Link>

      <div data-tour="employer-stats">
        <Suspense fallback={<StatsSkeleton />}>
          <KeyTiles candidatesHref={candidatesHref} />
        </Suspense>
      </div>

      <EmployerSections />

      {!hasVacancies ? (
        <EmptyState icon={PlusCircle} title={t("employer.dashboard.empty_title")} description={t("employer.dashboard.empty_desc")} />
      ) : null}

      {hasVacancies ? (
        <Suspense fallback={<RowsSectionSkeleton />}>
          <RecentApplicationsSection userId={userId} companyId={companyId} limit={3} title={t("employer.dashboard.stats.new_applications")} />
        </Suspense>
      ) : null}

      {latestActive ? (
        <Suspense fallback={<CardsSectionSkeleton />}>
          <CandidatesSection
            title={t("employer.dashboard.matching")}
            subtitle={t("employer.dashboard.for_you_vacancy", { title: latestActive.title })}
            viewAllHref={candidatesHref}
            search={{ vacancyId: latestActive.id, categoryId: latestActive.category_id, sort: "relevant", limit: 3 }}
            hrefVacancyId={latestActive.id}
          />
        </Suspense>
      ) : (
        <Suspense fallback={<CardsSectionSkeleton />}>
          <CandidatesSection
            title={t("employer.dashboard.new_candidates")}
            viewAllHref={withCategory("/workers?sort=newest")}
            search={{ categoryId: latestCategoryId, sort: "newest", limit: 3 }}
          />
        </Suspense>
      )}

      {hasVacancies ? (
        <Suspense fallback={<RowsSectionSkeleton />}>
          <MyVacanciesSection userId={userId} companyId={companyId} limit={3} title={t("employer.dashboard.stats.active_vacancies")} />
        </Suspense>
      ) : null}

      <Link href="/workers" className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-4 text-sm font-semibold text-primary hover:bg-primary-soft/40">
        <Search className="size-4" /> {t("employer.dashboard.find_workers")}
      </Link>
    </div>
  );
}
