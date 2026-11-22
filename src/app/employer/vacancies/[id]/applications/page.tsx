import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireEmployer } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { Shell } from "@/components/shared/shell";
import { getManagedVacancy } from "@/features/applications/queries";
import { isApplicationStatus } from "@/features/applications/types";
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
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const { id } = await params;
  await requireEmployer(`/employer/vacancies/${id}/applications`);
  const vacancy = await getManagedVacancy(id);
  if (!vacancy) notFound();
  const sp = await searchParams;
  const rawStatus = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const status = isApplicationStatus(rawStatus) ? rawStatus : "all";
  return (
    <Shell forceRole="employer">
      {/* saralash — har doim eng yangisi (moslik yo'q, ega 2026-11-22) */}
      <EmployerPipeline vacancy={vacancy} status={status} sort="newest" />
    </Shell>
  );
}
