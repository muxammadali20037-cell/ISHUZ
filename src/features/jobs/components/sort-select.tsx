"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SORT_KEYS, jobsHref, type JobsSearchParams, type SortKey } from "../search-params";

export function SortSelect({ params, className }: { params: JobsSearchParams; className?: string }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className={cn("w-44", className)}>
      <Select
        aria-label={t("common.labels.sort")}
        value={params.sort}
        disabled={pending}
        options={SORT_KEYS.map((k) => ({ value: k, label: t(`common.labels.sort_${k}`) }))}
        onChange={(e) => {
          const sort = e.target.value as SortKey;
          startTransition(() => router.push(jobsHref(params, { sort, page: 1 })));
        }}
        className="h-10 text-sm"
      />
    </div>
  );
}
