"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, PartyPopper } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { finishOnboarding } from "../actions";
import { TOTAL_STEPS } from "../types";
import { errorMessage, stepHref } from "./wizard-shell";
import { celebrateAfterNavigation } from "@/lib/celebrate";

/** Yakunlash tugmasi: profil faollashadi → bosh sahifa + "Profil tayyor!" */
const INCOMPLETE_STEP: Record<string, number> = { incomplete_personal: 1, incomplete_location: 2, incomplete_profession: 3 };

export function FinishBar() {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const finish = () => {
    startTransition(async () => {
      const res = await finishOnboarding();
      if (!res.ok) {
        toast.error(errorMessage(t, res.error));
        const step = INCOMPLETE_STEP[res.error];
        if (step) router.push(stepHref(step));
        return;
      }
      celebrateAfterNavigation();
      toast.success(t("onboarding.worker.review.done_toast"), t("onboarding.worker.review.done_desc"));
      router.replace(res.data?.redirect ?? "/");
      router.refresh();
    });
  };

  return (
    <div className="sticky bottom-0 z-30 -mx-4 mt-6 border-t border-border/70 bg-background/95 px-4 pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
      <div className="flex gap-3">
        <Button asChild variant="outline" size="lg" className="shrink-0 px-4" aria-label={t("common.actions.back")}>
          <Link href={stepHref(TOTAL_STEPS)}>
            <ChevronLeft className="size-5" />
            <span className="hidden sm:inline">{t("common.actions.back")}</span>
          </Link>
        </Button>
        <Button type="button" size="lg" variant="success" className="flex-1" onClick={finish} loading={pending}>
          {!pending ? <PartyPopper className="size-5" /> : null}
          {t("common.actions.finish")}
        </Button>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">{t("onboarding.worker.review.finish_hint")}</p>
      <div className="h-3 pb-safe sm:h-0" />
    </div>
  );
}
