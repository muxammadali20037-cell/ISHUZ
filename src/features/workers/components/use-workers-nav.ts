"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buildWorkersUrl, type WorkerSearchParams } from "../search-params";

/** URL holatini yangilash: filtr o'zgarsa sahifa 1 ga qaytadi, o'tish transition ichida (skeleton ko'rinadi) */
export function useWorkersNav(params: WorkerSearchParams) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const navigate = useCallback(
    (patch: Partial<WorkerSearchParams>, opts: { scroll?: boolean } = {}) => {
      const url = buildWorkersUrl(params, patch);
      startTransition(() => {
        router.push(url, { scroll: opts.scroll ?? false });
      });
    },
    [params, router],
  );
  return { navigate, pending };
}
