"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { Category } from "@/lib/reference";
import { ProfessionPicker } from "@/features/professions/components/profession-picker";
import type { PickedProfession } from "@/features/professions/types";
import { MAX_PREF_PROFESSIONS } from "../prefs";
import { EntrySubmit, useHydrated } from "./entry-client";

/**
 * 05 · Bir nechta kasb tanlash: tepada tanlanganlar (olib tashlanadi), pastda umumiy kasb tanlagich (soha → kasb, qidiruv) —
 * har tanlovdan keyin u yana bo'sh holatga qaytadi. 5 tagacha. Tanlov formaga `p` maydonlari bo'lib ketadi (saveProfessionPrefs).
 */
export function ProfessionMultiPick({ categories, initial }: { categories: Category[]; initial: PickedProfession[] }) {
  const { t, name } = useT();
  const hydrated = useHydrated();
  const [picked, setPicked] = useState<PickedProfession[]>(initial.slice(0, MAX_PREF_PROFESSIONS));
  // tanlagichni har tanlovdan keyin yangidan ochish (qidiruv va yo'l tozalanadi)
  const [round, setRound] = useState(0);
  const full = picked.length >= MAX_PREF_PROFESSIONS;

  const add = (p: PickedProfession) => {
    setPicked((list) => (list.some((x) => x.id === p.id) || list.length >= MAX_PREF_PROFESSIONS ? list : [...list, p]));
    setRound((r) => r + 1);
  };

  return (
    <>
      {picked.map((p) => (
        <input key={p.id} type="hidden" name="p" value={p.id} />
      ))}
      <section aria-live="polite" className="mt-5" data-picked-professions>
        <p className="text-sm font-semibold text-muted-foreground">{t("welcome.entry.professions.picked", { count: picked.length, max: MAX_PREF_PROFESSIONS })}</p>
        {picked.length ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {picked.map((p) => {
              const label = p.trail.at(-1) ? name(p.trail.at(-1)!) : "";
              return (
                <li key={p.id}>
                  <span className="inline-flex min-h-11 items-center gap-1 rounded-full border border-primary bg-primary-soft pl-4 pr-1 text-sm font-semibold text-primary-ink">
                    {label}
                    <button
                      type="button"
                      onClick={() => setPicked((list) => list.filter((x) => x.id !== p.id))}
                      aria-label={t("welcome.entry.professions.remove", { name: label })}
                      className="inline-flex size-9 items-center justify-center rounded-full hover:bg-primary/10"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{t("welcome.entry.professions.empty")}</p>
        )}
      </section>

      <div className="mt-5">
        {full ? (
          <p className="rounded-xl bg-secondary p-3 text-sm font-medium">{t("welcome.entry.professions.limit", { max: MAX_PREF_PROFESSIONS })}</p>
        ) : (
          <ProfessionPicker key={round} categories={categories} value={null} onChange={add} title={picked.length ? t("welcome.entry.professions.add_more") : undefined} />
        )}
      </div>

      <div className="flex-1" />
      <div className="sticky bottom-0 z-10 -mx-5 mt-6 bg-background px-5 pb-[max(1rem,var(--safe-bottom))] pt-3">
        <EntrySubmit disabled={hydrated && picked.length === 0}>{t("welcome.entry.professions.continue")}</EntrySubmit>
      </div>
    </>
  );
}
