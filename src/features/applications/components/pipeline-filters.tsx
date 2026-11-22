"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import { ALL_STATUSES, type PipelineCounts, type PipelineStatusFilter } from "../types";

/**
 * Holat chiplari (sonlar bilan) — URL (?status=) orqali. Saralash ("Moslik bo'yicha") yo'q (ega, 2026-11-22: "moslik umuman
 * kerak emas") — arizalar har doim eng yangisi birinchi.
 */
export function PipelineFilters({ counts, status }: { counts: PipelineCounts; status: PipelineStatusFilter }) {
  const { t, tEnum } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const update = useCallback(
    (patch: Partial<{ status: PipelineStatusFilter }>) => {
      const next = new URLSearchParams(params.toString());
      if (patch.status !== undefined) {
        if (patch.status === "all") next.delete("status");
        else next.set("status", patch.status);
      }
      next.delete("sort");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const options: PipelineStatusFilter[] = ["all", ...ALL_STATUSES.filter((s) => counts[s] > 0 || s === status)];

  return (
    <div className="space-y-3">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0">
        {options.map((s) => {
          const label = s === "all" ? t("applications.pipeline.filter_all") : s === "sent" ? t("applications.pipeline.filter_sent") : tEnum("application_status", s);
          const selected = s === status;
          return (
            <Chip key={s} size="sm" selected={selected} onClick={() => update({ status: s })} className="shrink-0">
              {label}
              <span className={cn("rounded-full px-1.5 text-2xs font-bold tabular", selected ? "bg-primary-foreground/20" : "bg-secondary text-muted-foreground")}>{counts[s]}</span>
            </Chip>
          );
        })}
      </div>
    </div>
  );
}
