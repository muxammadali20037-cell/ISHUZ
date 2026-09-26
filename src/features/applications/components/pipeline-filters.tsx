"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownWideNarrow, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import { ALL_STATUSES, type PipelineCounts, type PipelineSort, type PipelineStatusFilter } from "../types";

/** Holat chiplari (sonlar bilan) + saralash — URL (?status=&sort=) orqali */
export function PipelineFilters({ counts, status, sort }: { counts: PipelineCounts; status: PipelineStatusFilter; sort: PipelineSort }) {
  const { t, tEnum } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const update = useCallback(
    (patch: Partial<{ status: PipelineStatusFilter; sort: PipelineSort }>) => {
      const next = new URLSearchParams(params.toString());
      if (patch.status !== undefined) {
        if (patch.status === "all") next.delete("status");
        else next.set("status", patch.status);
      }
      if (patch.sort !== undefined) {
        if (patch.sort === "match") next.delete("sort");
        else next.set("sort", patch.sort);
      }
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
              <span className={cn("rounded-full px-1.5 text-[11px] font-bold tabular", selected ? "bg-white/20" : "bg-secondary text-muted-foreground")}>{counts[s]}</span>
            </Chip>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{t("applications.pipeline.sort")}:</span>
        <Chip size="sm" selected={sort === "match"} onClick={() => update({ sort: "match" })} icon={<Sparkles />}>
          {t("applications.pipeline.sort_match")}
        </Chip>
        <Chip size="sm" selected={sort === "newest"} onClick={() => update({ sort: "newest" })} icon={<ArrowDownWideNarrow />}>
          {t("applications.pipeline.sort_newest")}
        </Chip>
      </div>
    </div>
  );
}
