"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { toast } from "@/components/ui/toast";
import { saveStep } from "../../actions";
import type { StepPayload } from "../../schema";
import { nextStep, prevStep, wizardHref, type StepKey, type WizardMode } from "../../steps";
import { errorMessage } from "../../utils";

/**
 * Qadamni saqlash: create rejimida keyingi qadamga o'tadi, edit rejimida joyida "Saqlandi" beradi.
 * Muddati tugagan vakansiya saqlanganda qoralamaga o'tadi (server) — foydalanuvchiga aytiladi.
 */
export function useSaveStep(mode: WizardMode, vacancyId: string, step: StepKey) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const save = (payload: StepPayload) => {
    startTransition(async () => {
      const res = await saveStep({ vacancyId, payload });
      if (!res.ok) {
        toast.error(errorMessage(t, res.error));
        return;
      }
      if (res.data?.movedToDraft) toast.info(t("vacancies.toast.moved_to_draft"), t("vacancies.toast.moved_to_draft_desc"));
      if (mode === "create") {
        router.push(wizardHref("create", vacancyId, nextStep(step)));
      } else {
        toast.success(t("vacancies.toast.saved"));
        router.refresh();
      }
    });
  };

  const skip = () => router.push(wizardHref(mode, vacancyId, nextStep(step)));
  const back = () => {
    const p = prevStep(step);
    if (p) router.push(wizardHref(mode, vacancyId, p));
  };

  return { save, skip, back, pending };
}
