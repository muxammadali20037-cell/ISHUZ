"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { toast } from "@/components/ui/toast";
import { setApplicationStatus } from "../actions";
import { actionErrorText } from "../errors";
import type { EmployerStatus } from "../types";

/** Ish beruvchi holat o'zgartirishi: action → toast → refresh. `run` muvaffaqiyatda true qaytaradi. */
export function useStatusChange({ applicationId, vacancyId }: { applicationId: string; vacancyId: string }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (status: EmployerStatus, note?: string) =>
    new Promise<boolean>((resolve) => {
      startTransition(async () => {
        const res = await setApplicationStatus({ applicationId, vacancyId, status, note });
        if (!res.ok) {
          toast.error(actionErrorText(t, res.error));
          resolve(false);
          return;
        }
        toast.success(t("applications.candidate.status_changed"));
        router.refresh();
        resolve(true);
      });
    });

  return { pending, run };
}
