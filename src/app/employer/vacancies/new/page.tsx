import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireEmployer } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { getReferenceData, getSkills } from "@/lib/reference";
import { Shell } from "@/components/shared/shell";
import { getVacancyForManager } from "@/features/vacancies/queries";
import { isLocked } from "@/features/vacancies/status";
import { stepFromParam, type WizardStep } from "@/features/vacancies/steps";
import type { VacancyFull } from "@/features/vacancies/types";
import { isUuid } from "@/features/vacancies/utils";
import { VacancyWizard } from "@/features/vacancies/components/wizard/wizard";
import { aiEnabled } from "@/lib/ai/client";
import { AiCtaCard } from "@/features/ai/components/ai-composer";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("vacancies.meta.new_title") };
}

/**
 * /employer/vacancies/new?id=<uuid>&step=<1..10|review>
 * id yo'q → 1-qadam (qoralama yaratiladi); id bor → shu qoralamani davom ettirish (refresh'da ham).
 */
export default async function NewVacancyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireEmployer("/employer/vacancies/new");
  const params = await searchParams;
  const id = typeof params.id === "string" ? params.id : undefined;

  let vacancy: VacancyFull | null = null;
  let step: WizardStep = "title";
  if (id) {
    if (!isUuid(id)) notFound();
    const res = await getVacancyForManager(id);
    if (!res) notFound();
    if (!res.access.canEdit || isLocked(res.vacancy.status)) redirect(`/employer/vacancies/${id}`);
    vacancy = res.vacancy;
    step = stepFromParam(params.step);
  }

  const [refs, suggestedSkills] = await Promise.all([getReferenceData(), step === "skills" ? getSkills(vacancy?.category_id ?? undefined) : Promise.resolve([])]);

  const { t } = await getT();
  return (
    <Shell hideNav>
      {!vacancy && aiEnabled() ? (
        <div className="container-narrow pt-5 sm:pt-8">
          <AiCtaCard title={t("ai.cta_employer")} description={t("ai.cta_employer_desc")} href="/employer/vacancies/new/ai" />
        </div>
      ) : null}
      <VacancyWizard mode="create" vacancy={vacancy} step={step} refs={refs} suggestedSkills={suggestedSkills} />
    </Shell>
  );
}
