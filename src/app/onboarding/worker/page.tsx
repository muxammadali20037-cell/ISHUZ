import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { getReferenceData } from "@/lib/reference";
import { Shell } from "@/components/shared/shell";
import { getSkillOptions, getSkillQuestions, getWorkerDraft } from "@/features/onboarding/queries";
import { WorkerWizard } from "@/features/onboarding/components/worker-wizard";
import { clampStep } from "@/features/onboarding/utils";
import { RememberReturnTo } from "@/features/onboarding/components/remember-return-to";
import { safeInternalPath } from "@/lib/security/safe-path";
import { getProfessionTrail } from "@/features/professions/queries";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("onboarding.worker.title"), robots: { index: false } };
}

/**
 * Ish qidiruvchi onboarding wizard'i: ?step= (1..9), saqlangan qadamdan oshib bo'lmaydi.
 * Har qadam server action orqali DB ga yoziladi; qaytib kelganda davom etadi.
 */
export default async function WorkerOnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string; next?: string }> }) {
  const { step: stepParam, next: rawNext } = await searchParams;
  // ?next= — tugagach qaytish (masalan, ariza oynasi bilan vakansiya); faqat shu saytdagi yo'l
  const next = safeInternalPath(rawNext, "") || null;
  const session = await requireSession(next ? `/onboarding/worker?next=${encodeURIComponent(next)}` : "/onboarding/worker");
  if (session.workerOnboarded) redirect(next ?? "/");

  const [draft, reference] = await Promise.all([getWorkerDraft(session), getReferenceData()]);
  const requested = stepParam ? Number.parseInt(stepParam, 10) : null;
  const step = clampStep(requested, draft.onboardingStep);
  const [skills, questions] =
    step === 5
      ? await Promise.all([getSkillOptions(session.userId), getSkillQuestions(draft.worker?.category_id ?? null, draft.worker?.subcategory_id ?? null, draft.worker?.profession_node_id ?? null)])
      : [null, []];
  const professionTrail = step === 3 ? await getProfessionTrail(draft.worker?.profession_node_id) : [];

  return (
    <Shell hideNav>
      {next ? <RememberReturnTo path={next} /> : null}
      <WorkerWizard step={step} draft={draft} reference={reference} skills={skills} questions={questions} professionTrail={professionTrail} userId={session.userId} />
    </Shell>
  );
}
