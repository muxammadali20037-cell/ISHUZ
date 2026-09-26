import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireEmployer } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { getBenefits } from "@/lib/reference";
import { Shell } from "@/components/shared/shell";
import { getApplicationStats, getMatchingWorkers, getVacancyForManager } from "@/features/vacancies/queries";
import { isUuid } from "@/features/vacancies/utils";
import { VacancyManage } from "@/features/vacancies/components/vacancy-manage";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { t } = await getT();
  const { id } = await params;
  const res = isUuid(id) ? await getVacancyForManager(id) : null;
  return { title: res ? `${res.vacancy.title} · ${t("vacancies.meta.manage_title")}` : t("vacancies.meta.manage_title") };
}

/** /employer/vacancies/[id] — boshqarish: holat, statistika, mos nomzodlar, ko'rinish */
export default async function ManageVacancyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireEmployer(`/employer/vacancies/${id}`);
  if (!isUuid(id)) notFound();
  const res = await getVacancyForManager(id);
  if (!res) notFound();

  const [stats, workers, benefits] = await Promise.all([getApplicationStats(id), getMatchingWorkers(id, res.vacancy.category_id), getBenefits()]);

  return (
    <Shell>
      <div className="container-app py-5 sm:py-8">
        <VacancyManage vacancy={res.vacancy} access={res.access} stats={stats} workers={workers} benefits={benefits} />
      </div>
    </Shell>
  );
}
