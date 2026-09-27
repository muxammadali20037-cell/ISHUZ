import { Suspense } from "react";
import Link from "next/link";
import { CrossRoleCard } from "@/components/shared/quick-actions";
import { Building2, PlusCircle, Search, ShieldCheck } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getCategories, getRegions } from "@/lib/reference";
import { initials } from "@/lib/format";
import type { SessionContext } from "@/features/auth/session";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { employerDisplayName } from "../../mappers";
import { getCompanyById, getEmployerProfile, getLatestVacancy, getMyVacancies } from "../../queries";
import { CandidatesSection } from "./candidates-section";
import { MyVacanciesSection } from "./my-vacancies-section";
import { RecentApplicationsSection } from "./recent-applications-section";
import { CardsSectionSkeleton, RowsSectionSkeleton, StatsSkeleton } from "./skeletons";
import { StatsTiles } from "./stats-tiles";
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
  const regionId = company?.region_id ?? profile?.region_id ?? null;
  const hasVacancies = anyVacancy.length > 0;

  // /workers havolalari slug bilan ishlaydi
  const [categories, regions] = await Promise.all([getCategories(), getRegions()]);
  const categorySlug = (id: string | null | undefined) => categories.find((c) => c.id === id)?.slug ?? null;
  const regionSlug = regions.find((r) => r.id === regionId)?.slug ?? null;
  const latestCategoryId = latestActive?.category_id ?? latestAny?.category_id ?? null;
  const latestCategorySlug = categorySlug(latestCategoryId);
  const withCategory = (base: string) => (latestCategorySlug ? `${base}&category=${latestCategorySlug}` : base);

  return (
    <div className="container-app py-6">
      {/* Sarlavha */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {company ? (
            <Avatar src={logoUrl} fallback={initials(name)} square size="xl" alt="" className="border border-border/70" />
          ) : (
            <Avatar src={session.profile.avatar_url} fallback={initials(session.profile.first_name, session.profile.last_name)} size="xl" alt="" />
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold sm:text-2xl">{t("employer.dashboard.greeting", { name })}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <VerificationBadge status={verification} label={tEnum("verification_status", verification)} />
              {verification === "unverified" || verification === "rejected" ? (
                <Link href="/company/settings#verification" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  <ShieldCheck className="size-4" /> {t("employer.dashboard.verify_cta")}
                </Link>
              ) : null}
              {company ? (
                <Link href={`/company/${company.slug}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                  <Building2 className="size-4" /> {t("employer.settings.public_page")}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild size="lg" className="flex-1 sm:flex-none">
            <Link href="/employer/vacancies/new">
              <PlusCircle className="size-5" /> {t("employer.dashboard.post_vacancy")}
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="flex-1 sm:flex-none">
            <Link href="/workers">
              <Search className="size-5" /> {t("employer.dashboard.find_workers")}
            </Link>
          </Button>
        </div>
      </header>

      <div className="mt-5">
        <CrossRoleCard role="employer" />
      </div>

      {/* Statistika */}
      <div className="mt-6">
        <Suspense fallback={<StatsSkeleton />}>
          <StatsTiles />
        </Suspense>
      </div>

      {!hasVacancies ? (
        <EmptyState
          className="mt-8"
          icon={PlusCircle}
          title={t("employer.dashboard.empty_title")}
          description={t("employer.dashboard.empty_desc")}
          action={{ label: t("employer.dashboard.empty_cta"), href: "/employer/vacancies/new" }}
        />
      ) : null}

      {/* Siz uchun nomzodlar (eng so'nggi faol vakansiya bo'yicha) */}
      {latestActive ? (
        <Suspense fallback={<CardsSectionSkeleton />}>
          <CandidatesSection
            title={t("employer.dashboard.for_you")}
            subtitle={t("employer.dashboard.for_you_vacancy", { title: latestActive.title })}
            viewAllHref={withCategory(`/workers?vacancy=${latestActive.id}&sort=relevant`)}
            search={{ vacancyId: latestActive.id, categoryId: latestActive.category_id, sort: "relevant", limit: 6 }}
            hrefVacancyId={latestActive.id}
          />
        </Suspense>
      ) : null}

      <Suspense fallback={<CardsSectionSkeleton />}>
        <CandidatesSection
          title={t("employer.dashboard.new_candidates")}
          viewAllHref={withCategory("/workers?sort=newest")}
          search={{ categoryId: latestCategoryId, sort: "newest", limit: 6 }}
        />
      </Suspense>

      <Suspense fallback={<CardsSectionSkeleton />}>
        <CandidatesSection
          title={t("employer.dashboard.today_seekers")}
          viewAllHref="/workers?status=active&availability=today"
          search={{ statuses: ["active"], availability: ["today"], sort: "newest", limit: 6 }}
        />
      </Suspense>

      {regionId ? (
        <Suspense fallback={<CardsSectionSkeleton />}>
          <CandidatesSection
            title={t("employer.dashboard.nearby")}
            viewAllHref={regionSlug ? `/workers?region=${regionSlug}` : "/workers"}
            search={{ regionId, sort: "newest", limit: 6 }}
          />
        </Suspense>
      ) : null}

      {hasVacancies ? (
        <>
          <Suspense fallback={<RowsSectionSkeleton />}>
            <MyVacanciesSection userId={userId} companyId={companyId} />
          </Suspense>
          <Suspense fallback={<RowsSectionSkeleton />}>
            <RecentApplicationsSection userId={userId} companyId={companyId} />
          </Suspense>
        </>
      ) : null}
    </div>
  );
}
