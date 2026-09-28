import type { ReactNode } from "react";
import { getT } from "@/lib/i18n/server";
import { aiEnabled } from "@/lib/ai/client";
import { AiCtaCard } from "@/features/ai/components/ai-composer";
import type { ReferenceData } from "@/lib/reference";
import { REVIEW_STEP, STEP_KEYS, type SkillOption, type SkillQuestion, type WorkerDraft } from "../types";
import { Review } from "./review";
import { WizardShell } from "./wizard-shell";
import { Step1Personal } from "./steps/step-1-personal";
import { Step2Location } from "./steps/step-2-location";
import { Step3Profession } from "./steps/step-3-profession";
import { Step4Experience } from "./steps/step-4-experience";
import { Step5Skills } from "./steps/step-5-skills";
import { Step6Education } from "./steps/step-6-education";
import { Step7Portfolio } from "./steps/step-7-portfolio";
import { Step8Preferences } from "./steps/step-8-preferences";

/**
 * Qadamni tanlab, unga faqat kerakli ma'lumotni uzatadi (server komponent).
 * Enum default'lari (remote_preference, experience_level, work_format) faqat o'sha qadam saqlangan bo'lsa ko'rsatiladi —
 * aks holda foydalanuvchi "tanlanmagan" holatni ko'radi.
 */
export async function WorkerWizard({
  step,
  draft,
  reference,
  skills,
  questions = [],
  userId,
}: {
  step: number;
  draft: WorkerDraft;
  reference: ReferenceData;
  skills: SkillOption[] | null;
  questions?: SkillQuestion[];
  userId: string;
}) {
  const { t } = await getT();
  const key = STEP_KEYS[step - 1] ?? "personal";
  const w = draft.worker;
  const saved = draft.onboardingStep;

  let content: ReactNode;
  switch (step) {
    case 1:
      content = (
        <>
          {aiEnabled() && saved <= 1 ? (
            <div className="mb-6">
              <AiCtaCard title={t("ai.cta_worker")} description={t("ai.cta_worker_desc")} href="/onboarding/worker/ai" />
            </div>
          ) : null}
          <Step1Personal userId={userId} profile={draft.profile} contacts={draft.contacts} />
        </>
      );
      break;
    case 2:
      content = (
        <Step2Location
          draft={{
            region_id: w?.region_id ?? null,
            district_id: w?.district_id ?? null,
            area_hint: w?.area_hint ?? null,
            remote_preference: w && saved > 2 ? w.remote_preference : null,
            locations: draft.locations,
            hasGeo: draft.hasGeo,
          }}
          regions={reference.regions}
          districts={reference.districts}
        />
      );
      break;
    case 3:
      content = (
        <Step3Profession
          draft={{ category_id: w?.category_id ?? null, subcategory_id: w?.subcategory_id ?? null, headline: w?.headline ?? null }}
          categories={reference.categories}
          subcategories={reference.subcategories}
        />
      );
      break;
    case 4:
      content = <Step4Experience draft={{ experience_level: w && saved > 4 ? w.experience_level : null, entries: draft.experience }} />;
      break;
    case 5:
      content = <Step5Skills draft={{ skills: draft.skills, languages: draft.languages }} options={skills ?? []} categoryId={w?.category_id ?? null} languages={reference.languages} questions={questions} />;
      break;
    case 6:
      content = <Step6Education draft={{ level: draft.education[0]?.level ?? null, entries: draft.education }} />;
      break;
    case 7: {
      const category = reference.categories.find((c) => c.id === w?.category_id);
      content = <Step7Portfolio userId={userId} items={draft.portfolio} recommended={category?.portfolio_recommended ?? false} />;
      break;
    }
    case 8:
      content = (
        <Step8Preferences
          draft={{ preferences: draft.preferences, work_format: w && saved > 8 ? w.work_format : null }}
          officialTerms={reference.benefits.filter((b) => b.kind === "official_term")}
        />
      );
      break;
    default:
      content = <Review draft={draft} reference={reference} />;
  }

  return (
    <WizardShell step={Math.min(step, REVIEW_STEP)} title={t(`onboarding.worker.steps.${key}.title`)} subtitle={t(`onboarding.worker.steps.${key}.subtitle`)}>
      {content}
    </WizardShell>
  );
}
