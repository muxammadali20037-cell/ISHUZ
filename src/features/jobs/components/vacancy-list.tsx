"use client";

import { useState } from "react";
import { VacancyCard, type VacancyCardData } from "@/components/shared/vacancy-card";
import { cn } from "@/lib/utils";
import { useSaveVacancy } from "./use-save-vacancy";

export type VacancyListLayout = "list" | "grid" | "row";

const LAYOUTS: Record<VacancyListLayout, string> = {
  list: "space-y-3",
  grid: "grid gap-3 md:grid-cols-2",
  row: "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:px-0",
};

/** VacancyCard ro'yxati + saqlash tugmasi (optimistik). Har qanday joyda: qidiruv, bosh sahifa, o'xshashlar. */
export function VacancyList({
  items,
  layout = "list",
  hideMatch,
  className,
}: {
  items: VacancyCardData[];
  layout?: VacancyListLayout;
  hideMatch?: boolean;
  className?: string;
}) {
  const { toggle, pendingId, dialog } = useSaveVacancy();
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const onToggleSave = async (id: string, next: boolean) => {
    setOverrides((o) => ({ ...o, [id]: next }));
    const ok = await toggle(id, next);
    if (!ok) setOverrides((o) => ({ ...o, [id]: !next }));
  };

  return (
    <>
      <div className={cn(LAYOUTS[layout], className)}>
        {items.map((v) => (
          <VacancyCard
            key={v.id}
            vacancy={{ ...v, is_saved: overrides[v.id] ?? v.is_saved }}
            onToggleSave={onToggleSave}
            saving={pendingId === v.id}
            hideMatch={hideMatch}
            className={layout === "row" ? "w-[300px] shrink-0 snap-start sm:w-[340px]" : undefined}
          />
        ))}
      </div>
      {dialog}
    </>
  );
}
