import { Suspense } from "react";
import Link from "next/link";
import { Building2, PlusCircle, ShieldCheck } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getCategories } from "@/lib/reference";
import type { SessionContext } from "@/features/auth/session";
import { EmptyState } from "@/components/ui/misc";
import { employerDisplayName } from "../../mappers";
import { getCompanyById, getEmployerProfile, getLatestVacancy, getMyVacancies } from "../../queries";
import { CandidatesSection } from "./candidates-section";
import { MyVacanciesSection } from "./my-vacancies-section";
import { RecentApplicationsSection } from "./recent-applications-section";
import { CardsSectionSkeleton, RowsSectionSkeleton } from "./skeletons";
import { KeyTiles, KeyTilesSkeleton } from "./stats-tiles";
import { EmployerSections } from "./employer-sections";
import { VerificationBadge } from "./status-badge";
import { EmployerHead } from "@/features/landing/employer-head";
import { getHomePlace } from "@/features/landing/home-queries";

/**
 * Ish beruvchi paneli (server) — 2.0: /employer va ish beruvchi rejimidagi bosh sahifa. Bosh qismi mehmon sahifasi bilan bir xil
 * (EmployerHead: savol, AI qidiruv maydoni, tez yo'llar, "Vakansiya joylash"), keyin "bugun nima qilish kerak" tartibi:
 * ko'rsatkichlar (haqiqiy) → yangi arizalar → ko'rib chiqiladigan nomzodlar → faol vakansiyalar → bo'limlar.
 * Olib tashlandi: fon surati, 8 ta plitka, arizalar holati qatori, ikkinchi matnli qidiruv — har bo'lim Suspense'da; bo'sh bo'lim ko'rinmaydi.
 */
export async function EmployerDashboard({ session, embedded = false }: { session: SessionContext & { employerId: string }; embedded?: boolean }) {
  const { t, tEnum } = await getT();
  const { userId, companyId } = session;
  const [profile, company, latestActive, latestAny, anyVacancy, place] = await Promise.all([
    getEmployerProfile(userId),
    companyId ? getCompanyById(companyId) : Promise.resolve(null),
    getLatestVacancy(userId, companyId, true),
    getLatestVacancy(userId, companyId, false),
    getMyVacancies(userId, companyId, 1),
    getHomePlace(),
  ]);

  const name = employerDisplayName({ companyName: company?.name, displayName: profile?.display_name, firstName: session.profile.first_name });
  const verification = company?.verification_status ?? profile?.verification_status ?? "unverified";
  const hasVacancies = anyVacancy.length > 0;

  // /workers havolalari slug bilan ishlaydi
  const categories = await getCategories();
  const categorySlug = (id: string | null | undefined) => categories.find((c) => c.id === id)?.slug ?? null;
  const latestCategoryId = latestActive?.category_id ?? latestAny?.category_id ?? null;
  const latestCategorySlug = categorySlug(latestCategoryId);
  const withCategory = (base: string) => (latestCategorySlug ? `${base}&category=${latestCategorySlug}` : base);
  const candidatesHref = latestActive ? withCategory(`/workers?vacancy=${latestActive.id}&sort=relevant`) : "/workers";

  // kompaniya holati: tasdiq belgisi, tasdiqlash havolasi, ommaviy sahifa
  const status = (
    <span className="flex flex-wrap items-center gap-2">
      <VerificationBadge status={verification} label={tEnum("verification_status", verification)} />
      {verification === "unverified" || verification === "rejected" ? (
        <Link href="/company/settings#verification" className="inline-flex min-h-8 items-center gap-1 text-sm font-semibold text-primary-ink hover:underline">
          <ShieldCheck className="size-4" aria-hidden /> {t("employer.dashboard.verify_cta")}
        </Link>
      ) : null}
      {company ? (
        <Link href={`/company/${company.slug}`} className="inline-flex min-h-8 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <Building2 className="size-4" aria-hidden /> {t("employer.settings.public_page")}
        </Link>
      ) : null}
    </span>
  );

  return (
    // embedded — bosh sahifa ichida (o'z konteyneri bor)
    <div className={embedded ? "space-y-6" : "container-app space-y-6 py-5 sm:py-8"}>
      <EmployerHead flush={embedded} greeting={t("employer.dashboard.greeting", { name })} place={place} postHref="/employer/vacancies/new" extra={status} />

      <Suspense fallback={<KeyTilesSkeleton />}>
        <KeyTiles candidatesHref={candidatesHref} />
      </Suspense>

      {!hasVacancies ? <EmptyState icon={PlusCircle} title={t("employer.dashboard.empty_title")} description={t("employer.dashboard.empty_desc")} /> : null}

      {hasVacancies ? (
        <Suspense fallback={<RowsSectionSkeleton />}>
          <RecentApplicationsSection userId={userId} companyId={companyId} limit={5} title={t("employer.dashboard.stats.new_applications")} />
        </Suspense>
      ) : null}

      {latestActive ? (
        <Suspense fallback={<CardsSectionSkeleton />}>
          <CandidatesSection
            title={t("employer.dashboard.review_candidates")}
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
          <MyVacanciesSection userId={userId} companyId={companyId} limit={5} title={t("employer.dashboard.stats.active_vacancies")} />
        </Suspense>
      ) : null}

      <EmployerSections />
    </div>
  );
}
