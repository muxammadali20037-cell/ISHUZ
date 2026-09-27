import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { getLanguages, getReferenceData } from "@/lib/reference";
import { aiEnabled } from "@/lib/ai/client";
import { Shell } from "@/components/shared/shell";
import { WorkerAiAssistant } from "@/features/ai/components/worker-ai-assistant";

// AI tahlili 10–30 soniya olishi mumkin
export const maxDuration = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("ai.worker.title"), robots: { index: false } };
}

export default async function WorkerAiPage() {
  const session = await requireSession("/onboarding/worker/ai");
  if (!aiEnabled()) redirect("/onboarding/worker");
  const [refs, languages] = await Promise.all([getReferenceData(), getLanguages()]);
  const p = session.profile;
  return (
    <Shell hideNav>
      <WorkerAiAssistant
        manualHref={session.workerOnboarded ? "/profile/edit" : "/onboarding/worker?step=1"}
        refs={{ categories: refs.categories, subcategories: refs.subcategories, regions: refs.regions, districts: refs.districts, languages }}
        current={{ first_name: p.first_name ?? "", last_name: p.last_name ?? "", birth_date: p.birth_date ?? "", gender: p.gender ?? null }}
      />
    </Shell>
  );
}
