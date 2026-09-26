import type { Metadata } from "next";
import { requireEmployer } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { Shell } from "@/components/shared/shell";
import { EmployerDashboard } from "@/features/employer/components/dashboard/employer-dashboard";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("common.nav.dashboard"), robots: { index: false } };
}

/** /employer — ish beruvchi dashboardi (onboarding tugallanmagan bo'lsa → /onboarding/employer) */
export default async function EmployerPage() {
  const session = await requireEmployer("/employer");
  return (
    <Shell forceRole="employer">
      <EmployerDashboard session={session} />
    </Shell>
  );
}
