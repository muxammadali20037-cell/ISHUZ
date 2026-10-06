import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import type { SessionContext } from "@/features/auth/session";
import { HomeSection } from "@/features/jobs/components/home/home-section";
import { WorkerStats } from "@/features/jobs/components/home/worker-stats";
import { HomeSectionSkeleton, StatsSkeleton } from "@/features/jobs/components/skeletons";
import { getWorkerHomeContext } from "@/features/jobs/queries";
import { jobsHref } from "@/features/jobs/search-params";
import { createClient } from "@/lib/supabase/server";
import { TopProfileCard } from "@/features/billing/components/top-profile-card";
import { aiEnabled } from "@/lib/ai/client";
import { billingEnabled } from "@/lib/features";
import { AiCtaCard } from "@/features/ai/components/ai-composer";
import { ProfessionFocus } from "@/features/professions/components/profession-focus";
import { WorkerMainCards } from "./worker-main-cards";

/**
 * Ish qidiruvchi dashboardi ("/"): salomlashuv + qidiruv, ko'rsatkichlar, profil to'liqligi,
 * aniq kasb kartasi, "Siz uchun" / "Yangi" / "Yaqin atrofda" bo'limlari; qolgan filtrlar — tezkor tugmalar.
 */
export async function WorkerHome({ session }: { session: SessionContext }) {
  if (!session.workerId || !session.workerOnboarded) redirect("/onboarding/worker");
  const supabase = await createClient();
  const [{ t }, ctx, promo] = await Promise.all([
    getT(),
    getWorkerHomeContext(session.workerId),
    supabase.from("worker_profiles").select("promoted_until").eq("id", session.workerId).maybeSingle(),
  ]);
  const firstName = session.profile.first_name?.trim() || t("common.role.worker");
  const hasDistricts = ctx.districtIds.length > 0;

  return (
    <div className="container-app space-y-7 py-5 sm:py-8">
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("jobs.home.greeting", { name: firstName })}</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">{t("jobs.home.subtitle")}</p>
        </div>
        <WorkerMainCards workerId={session.workerId} />
      </section>

      <Suspense fallback={null}>
        <ProfessionFocus workerId={session.workerId} categorySlug={ctx.categorySlug} />
      </Suspense>

      <Suspense fallback={<HomeSectionSkeleton />}>
        <HomeSection
          title={t("jobs.home.for_you")}
          href={jobsHref({ category: ctx.categorySlug, district: ctx.districtIds })}
          args={{ p_category_id: ctx.categoryId ?? undefined, p_district_ids: hasDistricts ? ctx.districtIds : undefined, p_sort: "relevant" }}
        />
      </Suspense>

      <Suspense fallback={<HomeSectionSkeleton />}>
        <HomeSection title={t("jobs.home.newest")} href={jobsHref({ sort: "newest" })} args={{ p_sort: "newest" }} />
      </Suspense>

      {hasDistricts ? (
        <Suspense fallback={<HomeSectionSkeleton />}>
          <HomeSection
            title={t("jobs.home.nearby")}
            href={jobsHref({ district: ctx.districtIds, sort: "newest" })}
            args={{ p_district_ids: ctx.districtIds, p_sort: "newest" }}
          />
        </Suspense>
      ) : null}

      <Suspense fallback={<StatsSkeleton />}>
        <WorkerStats />
      </Suspense>

      {billingEnabled() ? <TopProfileCard workerId={session.workerId} promotedUntil={promo.data?.promoted_until ?? null} /> : null}
      {aiEnabled() ? <AiCtaCard title={t("ai.cta_worker_update")} description={t("ai.cta_worker_update_desc")} href="/onboarding/worker/ai" /> : null}
    </div>
  );
}
