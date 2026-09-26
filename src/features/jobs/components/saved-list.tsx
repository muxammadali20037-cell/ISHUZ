"use client";

import { useState } from "react";
import { BookmarkX, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { VacancyCard } from "@/components/shared/vacancy-card";
import type { SavedVacancyItem } from "../types";
import { useSaveVacancy } from "./use-save-vacancy";

/** Saqlangan vakansiyalar ro'yxati: faol → VacancyCard (× bilan), nofaol → kulrang "muddati tugagan" karta */
export function SavedList({ items: initial, onEmpty }: { items: SavedVacancyItem[]; onEmpty: React.ReactNode }) {
  const { t, locale } = useT();
  const { toggle, pendingId, dialog } = useSaveVacancy();
  const [items, setItems] = useState(initial);

  const remove = async (vacancyId: string) => {
    const ok = await toggle(vacancyId, false);
    if (ok) setItems((list) => list.filter((i) => i.vacancyId !== vacancyId));
  };

  if (!items.length) return <>{onEmpty}</>;

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) =>
          item.card ? (
            <VacancyCard key={item.vacancyId} vacancy={item.card} onToggleSave={(id) => void remove(id)} saving={pendingId === item.vacancyId} />
          ) : (
            <div key={item.vacancyId} className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-secondary/40 p-4 text-muted-foreground">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary">
                <BookmarkX className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground/80">{t("saved.expired_title")}</p>
                <p className="text-xs">{t("saved.expired_desc")}</p>
                <p className="mt-0.5 text-xs">{t("saved.saved_at", { time: formatRelative(item.savedAt, locale) })}</p>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={t("saved.remove")} loading={pendingId === item.vacancyId} onClick={() => void remove(item.vacancyId)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ),
        )}
      </div>
      {dialog}
    </>
  );
}
