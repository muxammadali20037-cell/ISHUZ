"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { setLocale } from "@/features/auth/actions";
import { cn } from "@/lib/utils";
import { pickLanguage } from "../actions";
import { EntrySubmit, useHydrated } from "./entry-client";
import { LocaleFlag } from "./flags";

/** Tillar o'z yozuvida (foydalanuvchi o'z tilini tanib olsin) */
const NATIVE: Record<Locale, { name: string; lang: string }> = {
  uz: { name: "O'zbekcha", lang: "uz-Latn" },
  oz: { name: "Ўзбекча", lang: "uz-Cyrl" },
  ru: { name: "Русский", lang: "ru" },
  en: { name: "English", lang: "en" },
};

/**
 * 2-ekran: til kartalari. Bosilgan til darhol saqlanadi va ekran shu tilga o'tadi (keyingi ekranlar ham shu tilda);
 * "Davom etish" faqat tanlangandan keyin faol. JS ishlamasa — oddiy forma (radio + yuborish).
 */
export function LanguagePicker({ current, chosen }: { current: Locale; chosen: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const hydrated = useHydrated();
  const [picked, setPicked] = useState<Locale | null>(chosen ? current : null);
  const [, start] = useTransition();

  const choose = (l: Locale) => {
    setPicked(l);
    start(async () => {
      // tarmoq uzilsa — tanlov "Davom etish"da baribir yuboriladi
      await setLocale(l).catch(() => undefined);
      router.refresh();
    });
  };

  return (
    <form action={pickLanguage} className="flex flex-1 flex-col">
      <fieldset className="mt-8 space-y-3">
        <legend className="sr-only">{t("welcome.entry.language.title")}</legend>
        {LOCALES.map((l) => {
          const on = picked === l;
          return (
            <label
              key={l}
              lang={NATIVE[l].lang}
              className={cn(
                "press flex min-h-16 cursor-pointer items-center gap-4 rounded-2xl border-2 bg-card px-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                on ? "border-primary bg-primary-soft" : "border-border hover:border-primary/50",
              )}
            >
              <input type="radio" name="locale" value={l} required checked={on} onChange={() => choose(l)} className="sr-only" data-testid={`lang-${l}`} />
              <LocaleFlag locale={l} />
              <span className="flex-1 text-lg font-bold">{NATIVE[l].name}</span>
              <span className={cn("flex size-6 items-center justify-center rounded-full border-2", on ? "border-primary bg-primary text-primary-foreground" : "border-border")} aria-hidden>
                {on ? <Check className="size-4" strokeWidth={3} /> : null}
              </span>
            </label>
          );
        })}
      </fieldset>
      <p className="mt-4 text-center text-sm text-muted-foreground">{t("welcome.entry.language.hint")}</p>
      <div className="flex-1" />
      <div className="sticky bottom-0 -mx-5 bg-background px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <EntrySubmit disabled={hydrated && !picked}>{t("welcome.entry.language.continue")}</EntrySubmit>
      </div>
    </form>
  );
}
