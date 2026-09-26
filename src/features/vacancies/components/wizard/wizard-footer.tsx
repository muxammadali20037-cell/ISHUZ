"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { isOptionalStep, prevStep, type StepKey, type WizardMode } from "../../steps";

/**
 * Qadam pastki paneli (mobil: yopishqoq). Forma ichida ishlatiladi — asosiy tugma type="submit".
 */
export function WizardFooter({
  mode,
  step,
  pending,
  onBack,
  onSkip,
  submitLabel,
  disabled,
}: {
  mode: WizardMode;
  step: StepKey;
  pending: boolean;
  onBack?: () => void;
  onSkip?: () => void;
  submitLabel?: string;
  disabled?: boolean;
}) {
  const { t } = useT();
  const canBack = mode === "create" && prevStep(step) !== null && !!onBack;
  const canSkip = mode === "create" && isOptionalStep(step) && !!onSkip;
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-border bg-card/95 px-4 py-3 pb-safe backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
      <div className="flex items-center gap-2">
        {canBack ? (
          <Button type="button" variant="ghost" onClick={onBack} disabled={pending}>
            <ChevronLeft className="size-4" /> {t("vacancies.actions.back")}
          </Button>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {canSkip ? (
            <Button type="button" variant="secondary" onClick={onSkip} disabled={pending}>
              {t("vacancies.actions.later")}
            </Button>
          ) : null}
          <Button type="submit" loading={pending} disabled={disabled} size="lg" className="min-w-36">
            {submitLabel ?? t(mode === "create" ? "vacancies.actions.continue" : "vacancies.actions.save")}
            {mode === "create" ? <ChevronRight className="size-4" /> : null}
          </Button>
        </div>
      </div>
    </div>
  );
}
