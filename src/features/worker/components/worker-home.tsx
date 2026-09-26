import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import type { SessionContext } from "@/features/auth/session";
import { CategoryGrid } from "@/features/jobs/components/home/category-grid";
import { HomeSearch } from "@/features/jobs/components/home/home-search";
import { HomeSection } from "@/features/jobs/components/home/home-section";
import { WorkerStats } from "@/features/jobs/components/home/worker-stats";
import { HomeSectionSkeleton, StatsSkeleton } from "@/features/jobs/components/skeletons";
import { getWorkerHomeContext } from "@/features/jobs/queries";
import { jobsHref } from "@/features/jobs/search-params";

/**
 * Ish qidiruvchi dashboardi ("/"): salomlashuv + qidiruv, ko'rsatkichlar, profil to'liqligi,
 * "Siz uchun" / "Yaqin atrofda" / "Yangi" / "Yuqori maoshli" / "Tajribasiz" / "Masofaviy" bo'limlari (har biri Suspense bilan oqimlanadi),
 * kategoriyalar to'ri.
 */
export async function WorkerHome({ session }: { session: SessionContext }) {
  if (!session.workerId || !session.workerOnboarded) redirect("/onboarding/worker");
  const [{ t }, ctx] = await Promise.all([getT(), getWorkerHomeContext(session.workerId)]);
  const firstName = session.profile.first_name?.trim() || t("common.role.worker");
  const hasDistricts = ctx.districtIds.length > 0;

  return (
    <div className="container-app space-y-8 py-5 sm:py-8">
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("jobs.home.greeting", { name: firstName })}</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">{t("jobs.home.subtitle")}</p>
        </div>
        <HomeSearch className="max-w-2xl" />
      </section>

      <Suspense fallback={<StatsSkeleton />}>
        <WorkerStats />
      </Suspense>

      <Suspense fallback={<HomeSectionSkeleton />}>
        <HomeSection
          title={t("jobs.home.for_you")}
          href={jobsHref({ category: ctx.categorySlug, district: ctx.districtIds })}
          args={{ p_category_id: ctx.categoryId ?? undefined, p_district_ids: hasDistricts ? ctx.districtIds : undefined, p_sort: "relevant" }}
        />
      </Suspense>

      {hasDistricts ? (
        <Suspense fallback={<HomeSectionSkeleton />}>
          <HomeSection title={t("jobs.home.nearby")} href={jobsHref({ district: ctx.districtIds, sort: "newest" })} args={{ p_district_ids: ctx.districtIds, p_sort: "newest" }} />
        </Suspense>
      ) : null}

      <Suspense fallback={<HomeSectionSkeleton />}>
        <HomeSection title={t("jobs.home.newest")} href={jobsHref({ sort: "newest" })} args={{ p_sort: "newest" }} />
      </Suspense>

      <Suspense fallback={<HomeSectionSkeleton />}>
        <HomeSection title={t("jobs.home.top_salary")} href={jobsHref({ sort: "salary" })} args={{ p_sort: "salary" }} />
      </Suspense>

      <Suspense fallback={<HomeSectionSkeleton />}>
        <HomeSection title={t("jobs.home.no_experience")} href={jobsHref({ noExperience: true })} args={{ p_no_experience: true, p_sort: "relevant" }} />
      </Suspense>

      <Suspense fallback={<HomeSectionSkeleton />}>
        <HomeSection title={t("jobs.home.remote")} href={jobsHref({ remote: true })} args={{ p_is_remote: true, p_sort: "newest" }} />
      </Suspense>

      <Suspense fallback={<HomeSectionSkeleton />}>
        <CategoryGrid />
      </Suspense>
    </div>
  );
}
