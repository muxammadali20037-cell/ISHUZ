"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { toast } from "@/components/ui/toast";
import type { ActionResult } from "@/features/auth/actions";
import { errorText } from "./note-dialog";

/** Server action'ni ishga tushirish: pending + toast + router.refresh() */
export function useAdminAction() {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = <T,>(fn: () => Promise<ActionResult<T>>, opts?: { success?: string; onOk?: (data: T | undefined) => void }) => {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(errorText(t, res.error));
        return;
      }
      toast.success(opts?.success ?? t("admin.common.done"));
      opts?.onOk?.(res.data);
      router.refresh();
    });
  };
  return { pending, run };
}
