"use client";

import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { AppMode } from "@/features/mode/mode";
import { cn } from "@/lib/utils";
import { pickRole } from "../actions";
import { EntrySubmit, useHydrated } from "./entry-client";

/**
 * 7-ekran: ikkita katta karta (rasm, nom, izoh). Tanlov — mavjud chooseMode (qurilma cookie'si + kirgan bo'lsa active_role).
 * Bitta hisobda keyin ikkinchi rolni ham qo'shish mumkin — rollar aralashmaydi. JS'siz ham ishlaydi (radio + forma).
 */
export function RolePicker({ initial, next, images }: { initial: AppMode | null; next: string; images: Record<AppMode, ReactNode> }) {
  const { t } = useT();
  const hydrated = useHydrated();
  const [mode, setMode] = useState<AppMode | null>(initial);
  const items = [
    { mode: "worker" as const, title: t("welcome.entry.role.worker_title"), desc: t("welcome.entry.role.worker_desc") },
    { mode: "employer" as const, title: t("welcome.entry.role.employer_title"), desc: t("welcome.entry.role.employer_desc") },
  ];
  return (
    <form action={pickRole} className="flex flex-1 flex-col">
      <input type="hidden" name="next" value={next} />
      <fieldset className="mt-8 grid gap-3">
        <legend className="sr-only">{t("welcome.entry.role.title")}</legend>
        {items.map((it) => {
          const on = mode === it.mode;
          return (
            <label
              key={it.mode}
              className={cn(
                "press relative flex cursor-pointer items-center gap-4 rounded-2xl border-2 bg-card p-3 pr-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                on ? "border-primary bg-primary-soft" : "border-border hover:border-primary/50",
              )}
            >
              <input type="radio" name="mode" value={it.mode} required checked={on} onChange={() => setMode(it.mode)} className="sr-only" data-testid={`role-${it.mode}`} />
              <span className="size-24 shrink-0 overflow-hidden rounded-xl">{images[it.mode]}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-extrabold leading-tight">{it.title}</span>
                <span className="mt-1 block text-sm leading-snug text-muted-foreground">{it.desc}</span>
              </span>
              <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full border-2", on ? "border-primary bg-primary text-primary-foreground" : "border-border")} aria-hidden>
                {on ? <Check className="size-4" strokeWidth={3} /> : null}
              </span>
            </label>
          );
        })}
      </fieldset>
      <p className="mt-4 text-center text-sm text-muted-foreground">{t("welcome.entry.role.note")}</p>
      <div className="flex-1" />
      <div className="sticky bottom-0 -mx-5 bg-background px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <EntrySubmit disabled={hydrated && !mode}>{t("welcome.entry.role.continue")}</EntrySubmit>
      </div>
    </form>
  );
}
