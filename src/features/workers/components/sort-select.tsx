"use client";

import { ArrowUpDown } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Select } from "@/components/ui/select";
import { WORKER_SORTS, type WorkerSearchParams, type WorkerSort } from "../search-params";
import { useWorkersNav } from "./use-workers-nav";

export function SortSelect({ params, hasOrigin }: { params: WorkerSearchParams; hasOrigin: boolean }) {
  const { t } = useT();
  const { navigate, pending } = useWorkersNav(params);
  const options = WORKER_SORTS.filter((s) => s !== "distance" || hasOrigin).map((s) => ({ value: s, label: t(`workers.sort.${s}`) }));
  const value: WorkerSort = params.sort === "distance" && !hasOrigin ? "relevant" : params.sort;
  return (
    <div className="flex items-center gap-2">
      <ArrowUpDown className="hidden size-4 text-muted-foreground sm:block" aria-hidden />
      <Select
        aria-label={t("workers.sort.label")}
        options={options}
        value={value}
        disabled={pending}
        onChange={(e) => navigate({ sort: e.target.value as WorkerSort, page: params.page })}
        className="h-10 w-auto min-w-[11rem] text-sm"
      />
    </div>
  );
}
