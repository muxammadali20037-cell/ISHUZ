"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Globe } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/config";
import { setLocale } from "@/features/auth/actions";
import { cn } from "@/lib/utils";

/** UZ | RU almashtirgich. Tanlov cookie + profilda saqlanadi. */
export function LanguageSwitcher({ className, size = "sm" }: { className?: string; size?: "sm" | "md" }) {
  const { locale } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const change = (next: Locale) => {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  };

  return (
    <div className={cn("inline-flex rounded-lg bg-secondary p-0.5", pending && "opacity-60", className)} role="group" aria-label="Language">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => change(l)}
          className={cn(
            "rounded-md font-semibold transition-colors",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
            l === locale ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
          aria-pressed={l === locale}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}

const LOCALE_NAMES: Record<Locale, string> = { uz: "O'zbekcha", oz: "Ўзбекча", ru: "Русский", en: "English" };

/** Ixcham til tanlagich (telefonda ham sig'adi): globus + qisqa nom, ochilganda to'liq nomlar */
export function LanguageSelect({ className }: { className?: string }) {
  const { locale } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label className={cn("relative inline-flex h-11 items-center gap-1 rounded-xl border border-border bg-card pl-2.5 pr-2 text-sm font-bold", pending && "opacity-60", className)}>
      <Globe className="size-4 text-muted-foreground" aria-hidden />
      <span aria-hidden>{LOCALE_LABELS[locale]}</span>
      <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      <select
        aria-label="Til · Тил · Язык · Language"
        value={locale}
        onChange={(e) => {
          const next = e.target.value as Locale;
          startTransition(async () => {
            await setLocale(next);
            router.refresh();
          });
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l === "oz" ? "uz-Cyrl" : l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
