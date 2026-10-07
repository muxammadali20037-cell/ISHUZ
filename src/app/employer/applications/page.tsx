import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { requireEmployer } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { Shell } from "@/components/shared/shell";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { getRecentApplications } from "@/features/employer/queries";
import { RecentApplicationsSection } from "@/features/employer/components/dashboard/recent-applications-section";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("employer.sections.applications"), robots: { index: false } };
}

/** /employer/applications — kompaniyaga kelgan barcha arizalar (barcha vakansiyalar bo'yicha, eng yangisi tepada) */
export default async function EmployerApplicationsPage() {
  const session = await requireEmployer("/employer/applications");
  const { t } = await getT();
  const any = await getRecentApplications(session.userId, session.companyId, 1);
  return (
    <Shell forceRole="employer">
      <div className="container-app py-5 sm:py-8">
        <PageHeader title={t("employer.sections.applications")} subtitle={t("employer.sections.applications_desc")} />
        {any.length ? (
          <RecentApplicationsSection userId={session.userId} companyId={session.companyId} limit={100} title={t("employer.sections.applications_all")} />
        ) : (
          <EmptyState icon={Inbox} title={t("employer.sections.applications_empty")} description={t("employer.sections.applications_empty_desc")} />
        )}
      </div>
    </Shell>
  );
}
