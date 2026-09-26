"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { toast } from "@/components/ui/toast";
import type { ActionResult } from "@/features/auth/actions";
import { actionErrorMessage } from "../i18n-helpers";

/**
 * Server action'ni transition ichida bajaradi: xato → toast.error, muvaffaqiyat → toast.success + router.refresh().
 */
export function useAction() {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = useCallback(
    <T,>(fn: () => Promise<ActionResult<T>>, opts: { success?: string | null; refresh?: boolean; onSuccess?: (data: T | undefined) => void; onError?: (code: string) => void } = {}) =>
      startTransition(async () => {
        const res = await fn();
        if (!res.ok) {
          toast.error(actionErrorMessage(t, res.error));
          opts.onError?.(res.error);
          return;
        }
        if (opts.success !== null) toast.success(opts.success ?? t("profile.toast.saved"));
        opts.onSuccess?.(res.data);
        if (opts.refresh !== false) router.refresh();
      }),
    [router, t],
  );

  return { pending, run };
}
