"use client";

import { useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { TFunction } from "@/lib/i18n/translate";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import type { ActionResult } from "@/features/auth/actions";
import { QUICK_STEPS, TOTAL_STEPS } from "../types";

import { stepHref } from "../utils";
import { finishOnboarding } from "../actions";

export { stepHref };

/** Xato kodi → matn: avval modul kalitlari, keyin umumiy/auth, oxirida generic */
export function errorMessage(t: TFunction, code: string): string {
  for (const key of [`onboarding.worker.errors.${code}`, `common.errors.${code}`, `auth.errors.${code}`]) {
    const msg = t(key);
    if (msg !== key) return msg;
  }
  return t("common.errors.generic");
}

/** react-hook-form xatosi (message = i18n kaliti) → matn */
export function fieldError(t: TFunction, error: { message?: string } | undefined): string | undefined {
  return error?.message ? t(error.message) : undefined;
}

/** ChipGroup onChange qiymatini bitta/ko'p tanlovga keltirish */
export function singleValue<T>(v: T | T[] | null): T | undefined {
  if (Array.isArray(v)) return v[0];
  return v ?? undefined;
}
export function multiValue<T>(v: T | T[] | null): T[] {
  if (Array.isArray(v)) return v;
  return v === null ? [] : [v];
}

/** Sarlavha + progress. Qadam 9 (tekshiruv) da progress to'la ko'rinadi */
export function WizardShell({ step, title, subtitle, children }: { step: number; title: string; subtitle?: string; children: ReactNode }) {
  const { t } = useT();
  return (
    <div className="container-narrow py-5 sm:py-8">
      {/* Majburiy qism — 4 qadam; qolganlari (ko'nikma, ta'lim...) keyin, ixtiyoriy */}
      <Stepper current={step <= QUICK_STEPS ? step : Math.min(step, TOTAL_STEPS)} total={step <= QUICK_STEPS ? QUICK_STEPS : TOTAL_STEPS} label={t("onboarding.worker.step_label")} />
      <div className="mt-5 sm:mt-7">
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-[15px] text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="mt-6 animate-fade-in">{children}</div>
    </div>
  );
}

/** Qadamni saqlash: action → xato bo'lsa toast, bo'lmasa keyingi qadamga */
export function useStepSubmit() {
  const router = useRouter();
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const submit = (run: () => Promise<ActionResult<{ nextStep: number }>>) => {
    startTransition(async () => {
      const res = await run();
      if (!res.ok) {
        toast.error(errorMessage(t, res.error));
        return;
      }
      router.push(stepHref(res.data?.nextStep ?? 1));
    });
  };
  /** Oxirgi majburiy qadam: saqlaydi va onboardingni yakunlaydi → bosh sahifa (qolgan bo'limlar keyin, ixtiyoriy) */
  const submitAndFinish = (run: () => Promise<ActionResult<unknown>>) => {
    startTransition(async () => {
      const res = await run();
      if (!res.ok) {
        toast.error(errorMessage(t, res.error));
        return;
      }
      const done = await finishOnboarding();
      if (!done.ok) {
        toast.error(errorMessage(t, done.error));
        return;
      }
      toast.success(t("onboarding.worker.quick_done"));
      router.replace(done.data?.redirect ?? "/");
      router.refresh();
    });
  };
  return { pending, submit, submitAndFinish };
}

/** Pastki tugmalar: Orqaga / Davom etish / (Keyinroq). Mobil — yopishqoq, desktop — oddiy */
export function WizardFooter({
  step,
  pending,
  onSkip,
  continueLabel,
  onBack,
}: {
  step: number;
  pending: boolean;
  onSkip?: () => void;
  continueLabel?: string;
  /** Qadam ichidagi oldingi savolga qaytish (bo'lmasa — oldingi qadam sahifasiga) */
  onBack?: () => void;
}) {
  const { t } = useT();
  return (
    <div className="sticky bottom-0 z-30 -mx-4 mt-8 border-t border-border/70 bg-background/95 px-4 pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-2 sm:backdrop-blur-none">
      <div className="flex gap-3">
        {onBack ? (
          <Button type="button" variant="outline" size="lg" className="shrink-0 px-4" aria-label={t("common.actions.back")} onClick={onBack} disabled={pending}>
            <ChevronLeft className="size-5" />
            <span className="hidden sm:inline">{t("common.actions.back")}</span>
          </Button>
        ) : step > 1 ? (
          <Button asChild variant="outline" size="lg" className="shrink-0 px-4" aria-label={t("common.actions.back")}>
            <Link href={stepHref(step - 1)}>
              <ChevronLeft className="size-5" />
              <span className="hidden sm:inline">{t("common.actions.back")}</span>
            </Link>
          </Button>
        ) : null}
        <Button type="submit" size="lg" loading={pending} className="flex-1">
          {continueLabel ?? t("common.actions.continue")}
          {!pending ? <ArrowRight className="size-5" /> : null}
        </Button>
      </div>
      {onSkip ? (
        <button
          type="button"
          onClick={onSkip}
          disabled={pending}
          className="mt-1 flex h-11 w-full items-center justify-center rounded-xl text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          {t("common.actions.skip")}
        </button>
      ) : null}
      <div className="h-3 pb-safe sm:h-0" />
    </div>
  );
}
