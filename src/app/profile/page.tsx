import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { requireSession } from "@/features/auth/session";
import { Shell } from "@/components/shared/shell";
import { WorkerProfileView } from "@/features/profile/components/profile-view";
import { EmployerSummary } from "@/features/profile/components/employer-summary";
import { getEmployerSummary } from "@/features/profile/queries";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("profile.meta.profile") };
}

/**
 * /profile:
 * - worker profili bor (va tugallangan) → ish qidiruvchi profili
 * - faqat employer → ish beruvchi qisqacha kartasi
 * - ikkalasi ham yo'q → /onboarding
 */
export default async function ProfilePage() {
  const session = await requireSession("/profile");

  if (session.workerId && session.workerOnboarded) {
    return (
      <Shell>
        <WorkerProfileView session={session} workerId={session.workerId} />
      </Shell>
    );
  }

  if (session.employerId) {
    const summary = await getEmployerSummary(session.userId);
    if (summary) {
      return (
        <Shell>
          <EmployerSummary session={session} data={summary} />
        </Shell>
      );
    }
  }

  if (session.workerId) redirect("/onboarding/worker");
  redirect("/onboarding");
}
