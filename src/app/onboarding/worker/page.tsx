import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { getReferenceData } from "@/lib/reference";
import { Shell } from "@/components/shared/shell";
import { getSkillOptions, getSkillQuestions, getWorkerDraft } from "@/features/onboarding/queries";
import { WorkerWizard } from "@/features/onboarding/components/worker-wizard";
import { clampStep } from "@/features/onboarding/utils";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("onboarding.worker.title"), robots: { index: false } };
}

/**
 * Ish qidiruvchi onboarding wizard'i: ?step= (1..9), saqlangan qadamdan oshib bo'lmaydi.
 * Har qadam server action orqali DB ga yoziladi; qaytib kelganda davom etadi.
 */
export default async function WorkerOnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const session = await requireSession("/onboarding/worker");
  if (session.workerOnboarded) redirect("/");

  const { step: stepParam } = await searchParams;
  const [draft, reference] = await Promise.all([getWorkerDraft(session), getReferenceData()]);
  const requested = stepParam ? Number.parseInt(stepParam, 10) : null;
  const step = clampStep(requested, draft.onboardingStep);
  const [skills, questions] =
    step === 5 ? await Promise.all([getSkillOptions(session.userId), getSkillQuestions(draft.worker?.category_id ?? null, draft.worker?.subcategory_id ?? null)]) : [null, []];

  return (
    <Shell hideNav>
      <WorkerWizard step={step} draft={draft} reference={reference} skills={skills} questions={questions} userId={session.userId} />
    </Shell>
  );
}
