import { Suspense } from "react";
import Link from "next/link";
import Form from "next/form";
import { Building2, Plus, PlusCircle, Search, ShieldCheck } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getCategories } from "@/lib/reference";
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
import { CardsSectionSkeleton, RowsSectionSkeleton } from "./skeletons";
import { KeyTiles, KeyTilesSkeleton, PipelineTiles } from "./stats-tiles";
import { EmployerSections } from "./employer-sections";
import { VerificationBadge } from "./status-badge";
import { AiFinder } from "@/features/find/components/ai-finder";
import { getHomeSettings } from "@/features/home-windows/queries";

/**
 * Ish beruvchi paneli (server): /employer va ish beruvchi rejimidagi bosh sahifa. Tartib: salomlashuv → vakansiya joylash va
 * nomzod qidirish → qisqa ko'rsatkichlar (haqiqiy ma'lumot) → yangi arizalar → mos nomzodlar → faol vakansiyalar → bo'limlar.
 * Har bo'lim Suspense'da; bo'sh bo'lim ko'rinmaydi.
 */
export async function EmployerDashboard({ session, embedded = false }: { session: SessionContext & { employerId: string }; embedded?: boolean }) {
  const { t, tEnum } = await getT();
  const { userId, companyId } = session;
  const [profile, company, latestActive, latestAny, anyVacancy, home] = await Promise.all([
    getEmployerProfile(userId),
    companyId ? getCompanyById(companyId) : Promise.resolve(null),
    getLatestVacancy(userId, companyId, true),
    getLatestVacancy(userId, companyId, false),
    getMyVacancies(userId, companyId, 1),
    getHomeSettings(),
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

  const postButton = (cls: string) => (
    <Button asChild size="lg" className={`h-12 px-5 text-base font-bold ${cls}`}>
      <Link href="/employer/vacancies/new">
        <Plus className="size-5" aria-hidden /> {t("easy.start.post_vacancy")}
      </Link>
    </Button>
  );

  /*
   * 2026-10: "bugun nima qilish kerak" tartibi — vakansiya joylash → yangi arizalar → ko'rib chiqiladigan nomzodlar →
   * faol vakansiyalar → nomzod qidirish (AI bilan) → bo'limlar. Katta rasmli plitkalar yo'q; kompyuterda jadval, telefonda qatorlar.
   */
  return (
    // embedded — bosh sahifa ichida (o'z konteyneri bor)
    <div className={embedded ? "space-y-6" : "container-app space-y-6 py-5 sm:py-8"}>
      <header className="flex items-center gap-3">
        {company ? (
          <Avatar src={logoUrl} fallback={initials(name)} square size="lg" alt="" className="border border-border" />
        ) : (
          <Avatar src={session.profile.avatar_url} fallback={initials(session.profile.first_name, session.profile.last_name)} size="lg" alt="" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="line-clamp-2 break-words text-xl font-bold sm:text-2xl">{t("employer.dashboard.greeting", { name })}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <VerificationBadge status={verification} label={tEnum("verification_status", verification)} />
            {verification === "unverified" || verification === "rejected" ? (
              <Link href="/company/settings#verification" className="inline-flex min-h-8 items-center gap-1 text-sm font-medium text-primary hover:underline">
                <ShieldCheck className="size-4" aria-hidden /> {t("employer.dashboard.verify_cta")}
              </Link>
            ) : null}
            {company ? (
              <Link href={`/company/${company.slug}`} className="hidden items-center gap-1 text-sm text-muted-foreground hover:text-foreground sm:inline-flex">
                <Building2 className="size-4" aria-hidden /> {t("employer.settings.public_page")}
              </Link>
            ) : null}
          </div>
        </div>
        {postButton("hidden shrink-0 sm:inline-flex")}
      </header>
      {postButton("w-full sm:hidden")}

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

      {hasVacancies ? (
        <Suspense fallback={null}>
          <PipelineTiles userId={userId} companyId={companyId} />
        </Suspense>
      ) : null}

      {/* Nomzod qidirish: matn bilan yoki AI bilan (suzuvchi tugma yo'q; admin o'chirsa — AI ko'rinmaydi) */}
      <section aria-labelledby="find-candidates" className="space-y-2">
        <h2 id="find-candidates" className="text-base font-bold">
          {t("employer.dashboard.find_title")}
        </h2>
        <div className="rounded-xl border border-input bg-card focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/25">
          <Form action="/search" prefetch={false} role="search" aria-label={t("easy.start.employer_search_label")} className="flex items-center gap-1 p-1">
            <input type="hidden" name="mode" value="workers" />
            <label className="flex min-w-0 flex-1 cursor-text items-center gap-2 pl-2.5">
              <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <input
                name="q"
                type="search"
                enterKeyHint="search"
                aria-label={t("easy.start.employer_search_label")}
                placeholder={t("easy.start.employer_search_placeholder")}
                maxLength={120}
                minLength={2}
                required
                className="h-12 w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              />
            </label>
            <Button type="submit" variant="outline" className="h-11 shrink-0 px-4 text-base font-semibold">
              {t("easy.start.search_button")}
            </Button>
          </Form>
          {home.aiButton ? (
            <div className="flex justify-end border-t border-border px-1">
              <AiFinder defaultMode="workers" locked />
            </div>
          ) : null}
        </div>
      </section>

      <EmployerSections />
    </div>
  );
}
