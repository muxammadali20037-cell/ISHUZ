"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
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
