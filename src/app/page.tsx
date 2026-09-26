import { redirect } from "next/navigation";
import { getSession } from "@/features/auth/session";
import { Shell } from "@/components/shared/shell";
import { LandingPage } from "@/features/landing/landing-page";
import { WorkerHome } from "@/features/worker/components/worker-home";

/**
 * Bosh sahifa:
 * - mehmon → landing (ikki katta karta)
 * - ish beruvchi rejimi → /employer
 * - ish qidiruvchi → shaxsiy dashboard (onboarding tugamagan bo'lsa → /onboarding/worker)
 */
export default async function HomePage() {
  const session = await getSession();
  if (!session) {
    return (
      <Shell forceRole="guest">
        <LandingPage />
      </Shell>
    );
  }
  if (session.profile.is_blocked) redirect("/blocked");
  if (session.activeRole === "employer") redirect("/employer");
  if (!session.workerId && !session.employerId) redirect("/onboarding");
  if (!session.workerOnboarded) redirect("/onboarding/worker");
  return (
    <Shell>
      <WorkerHome session={session} />
    </Shell>
  );
}
