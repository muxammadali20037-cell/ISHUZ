import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireEmployer } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { Shell } from "@/components/shared/shell";
import { canEditVacancy, getEmployerApplication, getManagedVacancy, markApplicationViewedOnOpen } from "@/features/applications/queries";
import { EmployerApplicationDetail } from "@/features/applications/components/employer-application-detail";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("applications.meta.candidate_title") };
}

/**
 * /employer/vacancies/[id]/applications/[applicationId] — nomzod tafsiloti.
 * Birinchi ochilishda (holat `sent`, tahrir huquqi bo'lsa) avtomatik `viewed` qilinadi.
 */
export default async function EmployerApplicationPage({ params }: { params: Promise<{ id: string; applicationId: string }> }) {
  const { id, applicationId } = await params;
  const session = await requireEmployer(`/employer/vacancies/${id}/applications/${applicationId}`);
  const vacancy = await getManagedVacancy(id);
  if (!vacancy) notFound();

  let app = await getEmployerApplication(applicationId, session.userId);
  if (!app || app.vacancy_id !== vacancy.id || app.candidate?.profile_id === session.userId) notFound();

  const canAct = await canEditVacancy(vacancy.id);
  if (canAct && app.status === "sent") {
    const marked = await markApplicationViewedOnOpen(app.id, app.status);
    if (marked) app = (await getEmployerApplication(applicationId, session.userId)) ?? app;
  }

  return (
    <Shell forceRole="employer">
      <EmployerApplicationDetail app={app} vacancy={vacancy} canAct={canAct} />
    </Shell>
  );
}
