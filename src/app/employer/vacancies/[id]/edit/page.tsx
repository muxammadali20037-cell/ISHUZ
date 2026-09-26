import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireEmployer } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { getReferenceData, getSkills } from "@/lib/reference";
import { Shell } from "@/components/shared/shell";
import { getVacancyForManager } from "@/features/vacancies/queries";
import { isLocked } from "@/features/vacancies/status";
import { stepFromParam } from "@/features/vacancies/steps";
import { isUuid } from "@/features/vacancies/utils";
import { LockedNotice } from "@/features/vacancies/components/locked-notice";
import { VacancyWizard } from "@/features/vacancies/components/wizard/wizard";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("vacancies.meta.edit_title") };
}

/**
 * /employer/vacancies/[id]/edit?step=<1..10|review> — o'sha wizard, tahrirlash rejimida (qadamlar orasida erkin o'tish).
 * hidden → qulflangan; viewer roli → faqat ko'rish.
 */
export default async function EditVacancyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  await requireEmployer(`/employer/vacancies/${id}/edit`);
  if (!isUuid(id)) notFound();
  const res = await getVacancyForManager(id);
  if (!res) notFound();

  if (!res.access.canEdit || isLocked(res.vacancy.status)) {
    return (
      <Shell hideNav>
        <LockedNotice vacancy={res.vacancy} reason={isLocked(res.vacancy.status) ? "hidden" : "viewer"} />
      </Shell>
    );
  }

  const step = stepFromParam((await searchParams).step);
  const [refs, suggestedSkills] = await Promise.all([getReferenceData(), step === "skills" ? getSkills(res.vacancy.category_id ?? undefined) : Promise.resolve([])]);

  return (
    <Shell hideNav>
      <VacancyWizard mode="edit" vacancy={res.vacancy} step={step} refs={refs} suggestedSkills={suggestedSkills} />
    </Shell>
  );
}
