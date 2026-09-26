"use client";

import { useCallback, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/dialog";
import { toggleSaveVacancy } from "../actions";
import { errorMessage } from "../i18n-helpers";

/**
 * Saqlash tugmasi mantiqi: server action → toast; kirmagan → /auth?next=; worker profili yo'q → dialog + /onboarding/worker.
 * `dialog` ni komponent daraxtida render qiling.
 */
export function useSaveVacancy() {
  const { t } = useT();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [needProfile, setNeedProfile] = useState(false);

  const toggle = useCallback(
    async (vacancyId: string, save: boolean): Promise<boolean> => {
      setPendingId(vacancyId);
      try {
        const res = await toggleSaveVacancy({ vacancyId, save });
        if (res.ok) {
          toast.success(t(save ? "jobs.save.saved" : "jobs.save.removed"));
          return true;
        }
        if (res.error === "not_authenticated") {
          const next = `${window.location.pathname}${window.location.search}`;
          router.push(`/auth?next=${encodeURIComponent(next)}`);
          return false;
        }
        if (res.error === "worker_profile_required") {
          setNeedProfile(true);
          return false;
        }
        toast.error(errorMessage(t, res.error, "jobs.save"), res.error === "blocked" ? undefined : t("jobs.save.failed"));
        return false;
      } finally {
        setPendingId(null);
      }
    },
    [router, t],
  );

  const dialog: ReactNode = (
    <ConfirmDialog
      open={needProfile}
      onOpenChange={setNeedProfile}
      title={t("jobs.save.profile_required_title")}
      description={t("jobs.save.profile_required_desc")}
      confirmLabel={t("jobs.save.profile_action")}
      cancelLabel={t("common.actions.cancel")}
      onConfirm={() => router.push("/onboarding/worker")}
    />
  );

  return { toggle, pendingId, dialog };
}
