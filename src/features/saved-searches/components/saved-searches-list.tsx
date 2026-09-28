"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, ChevronRight, Search, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { deleteSavedSearch, markSavedSearchSeen, setSavedSearchNotify } from "../actions";
import type { SavedSearchItem } from "../queries";

/** Saqlangan qidiruvlar: ochish (yangi hisoblagich nolga tushadi), xabarni yoqish/o'chirish, o'chirish */
export function SavedSearchesList({ items }: { items: SavedSearchItem[] }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean }>, success?: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(t("common.errors.generic"));
      else if (success) toast.info(success);
      router.refresh();
    });

  const open = (item: SavedSearchItem) =>
    startTransition(async () => {
      if (item.newCount > 0) await markSavedSearchSeen({ id: item.id });
      router.push(`/jobs?${item.queryString}`);
    });

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {items.map((s) => (
        <li key={s.id} className="flex items-center gap-2 px-3 py-2.5">
          <button type="button" onClick={() => open(s)} disabled={pending} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-1 text-left active:scale-[0.99]">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Search className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{s.label}</span>
              <span className="block text-xs text-muted-foreground">{s.notify ? t("saved.searches.notify_on") : t("saved.searches.notify_off")}</span>
            </span>
            {s.newCount > 0 ? <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">{t("saved.searches.new_count", { count: s.newCount })}</span> : null}
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={pending}
            aria-label={s.notify ? t("saved.searches.turn_off") : t("saved.searches.turn_on")}
            onClick={() => run(() => setSavedSearchNotify({ id: s.id, notify: !s.notify }))}
          >
            {s.notify ? <Bell className="size-4 text-primary" /> : <BellOff className="size-4 text-muted-foreground" />}
          </Button>
          <Button type="button" size="icon-sm" variant="ghost" disabled={pending} aria-label={t("common.actions.delete")} onClick={() => run(() => deleteSavedSearch({ id: s.id }), t("saved.searches.removed"))}>
            <Trash2 className="size-4 text-muted-foreground" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
