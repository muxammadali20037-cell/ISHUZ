import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowDown, Eye, PartyPopper } from "lucide-react";
import { requireEmployer } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { getBenefits } from "@/lib/reference";
import { Shell } from "@/components/shared/shell";
import { getApplicationStats, getMatchingWorkers, getVacancyForManager } from "@/features/vacancies/queries";
import { isUuid } from "@/features/vacancies/utils";
import { VacancyManage } from "@/features/vacancies/components/vacancy-manage";
import { getVacancyBySlug } from "@/features/jobs/queries";
import { buildPromoCaption, buildPromoData, vacancyUrl } from "@/features/promo/data";
import { PromoPanel } from "@/features/promo/promo-panel";
import { getSeekerView } from "@/features/vacancies/seeker-view";
import { SeekerViewPanel } from "@/features/vacancies/components/seeker-view-panel";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { t } = await getT();
  const { id } = await params;
  const res = isUuid(id) ? await getVacancyForManager(id) : null;
  return { title: res ? `${res.vacancy.title} · ${t("vacancies.meta.manage_title")}` : t("vacancies.meta.manage_title") };
}

/** /employer/vacancies/[id] — boshqarish: holat, statistika, mos nomzodlar, ko'rinish */
export default async function ManageVacancyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ published?: string }> }) {
  const { id } = await params;
  const justPublished = (await searchParams).published === "1";
  await requireEmployer(`/employer/vacancies/${id}`);
  if (!isUuid(id)) notFound();
  const res = await getVacancyForManager(id);
  if (!res) notFound();

  const [stats, workers, benefits, detail, tt] = await Promise.all([
    getApplicationStats(id),
    getMatchingWorkers(id, res.vacancy.category_id),
    getBenefits(),
    getVacancyBySlug(res.vacancy.slug),
    getT(),
  ]);
  const caption = detail ? buildPromoCaption(detail, buildPromoData(detail, tt), tt.t) : null;
  // "Ish izlovchilar qanday ko'radi": ko'rinish holati, qidiruvdagi o'rni, ro'yxat kartasi
  const seekerView = detail ? await getSeekerView(detail) : null;

  return (
    <Shell>
      <div className="container-app py-5 sm:py-8">
        {justPublished ? (
          <div data-published-banner className="mb-5 rounded-2xl bg-success p-5 text-success-foreground shadow-md">
            <div className="flex items-center gap-4">
              <PartyPopper className="size-9 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-extrabold">{tt.t("vacancies.published_banner.title")}</span>
                <span className="block text-sm opacity-90">
                  {workers.length ? tt.t("vacancies.published_banner.found", { count: workers.length }) : tt.t("vacancies.published_banner.none")}
                </span>
              </span>
            </div>
            {/* e'lon joylangach birinchi savol — "ish izlovchilarga qanday ko'rinyapti?" */}
            <div className="mt-3 flex flex-wrap gap-2">
              {seekerView ? (
                <a href="#korinish" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-success-foreground px-4 text-sm font-semibold text-success">
                  <Eye className="size-4" aria-hidden /> {tt.t("vacancies.published_banner.see_as_seeker")}
                </a>
              ) : null}
              {workers.length ? (
                <a href="#matching" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold ring-1 ring-success-foreground/60 hover:bg-success-foreground/10">
                  {tt.t("vacancies.published_banner.see_matching")} <ArrowDown className="size-4" aria-hidden />
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
        <VacancyManage
          vacancy={res.vacancy}
          access={res.access}
          stats={stats}
          workers={workers}
          benefits={benefits}
          seekerView={seekerView ? <SeekerViewPanel view={seekerView} /> : null}
        />
        {caption ? <PromoPanel slug={res.vacancy.slug} caption={caption} url={vacancyUrl(res.vacancy.slug)} isActive={res.vacancy.status === "active"} /> : null}
      </div>
    </Shell>
  );
}
