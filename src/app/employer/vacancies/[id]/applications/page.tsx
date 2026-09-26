import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireEmployer } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { Shell } from "@/components/shared/shell";
import { getManagedVacancy } from "@/features/applications/queries";
import { isApplicationStatus, isPipelineSort } from "@/features/applications/types";
import { EmployerPipeline } from "@/features/applications/components/employer-pipeline";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("applications.meta.pipeline_title") };
}

/** /employer/vacancies/[id]/applications?status=&sort= — nomzodlar pipeline'i (faqat vakansiya boshqaruvchisi) */
export default async function VacancyApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string | string[]; sort?: string | string[] }>;
}) {
  const { id } = await params;
  await requireEmployer(`/employer/vacancies/${id}/applications`);
  const vacancy = await getManagedVacancy(id);
  if (!vacancy) notFound();
  const sp = await searchParams;
  const rawStatus = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const rawSort = Array.isArray(sp.sort) ? sp.sort[0] : sp.sort;
  const status = isApplicationStatus(rawStatus) ? rawStatus : "all";
  const sort = isPipelineSort(rawSort) ? rawSort : "match";
  return (
    <Shell forceRole="employer">
      <EmployerPipeline vacancy={vacancy} status={status} sort={sort} />
    </Shell>
  );
}
