import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireEmployer } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { aiEnabled } from "@/lib/ai/client";
import { Shell } from "@/components/shared/shell";
import { VacancyAiComposer } from "@/features/ai/components/vacancy-ai-composer";

// AI tahlili + qoralama yaratish 10–30 soniya olishi mumkin
export const maxDuration = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("ai.employer.title"), robots: { index: false } };
}

export default async function VacancyAiPage() {
  await requireEmployer("/employer/vacancies/new/ai");
  if (!aiEnabled()) redirect("/employer/vacancies/new");
  return (
    <Shell hideNav>
      <VacancyAiComposer />
    </Shell>
  );
}
