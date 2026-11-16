"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { setLocale } from "@/features/auth/actions";
import { cn } from "@/lib/utils";

/** Tillar o'z yozuvida (foydalanuvchi o'z tilini tanib olsin) */
export const NATIVE: Record<Locale, { name: string; lang: string }> = {
  uz: { name: "O'zbekcha", lang: "uz-Latn" },
  oz: { name: "Ўзбекча", lang: "uz-Cyrl" },
  ru: { name: "Русский", lang: "ru" },
  en: { name: "English", lang: "en" },
};

/**
 * Xush kelibsiz ekranidagi til qatori (4.0: ixcham, bitta qator): bosilgan til darhol saqlanadi va ekran shu tilga o'tadi — alohida "Davom etish" yo'q.
 * JS ishlamasa — oddiy havolalar (?lang=…): proxy shu so'rovni o'sha tilda chizadi va cookie qo'yadi.
 */
export function WelcomeLanguage({ current }: { current: Locale }) {
  const { t } = useT();
  const router = useRouter();
  const [picked, setPicked] = useState<Locale>(current);
  const [, start] = useTransition();
  const choose = (l: Locale) => {
    if (l === picked) return;
    setPicked(l);
    start(async () => {
      await setLocale(l).catch(() => undefined);
      router.refresh();
    });
  };
  return (
    <nav aria-label={t("welcome.entry.language.title")} data-testid="welcome-languages" className="flex flex-wrap justify-center gap-1.5">
      {LOCALES.map((l) => {
        const on = picked === l;
        return (
          <a
            key={l}
            href={`/start/til?lang=${l}`}
            lang={NATIVE[l].lang}
            aria-current={on ? "true" : undefined}
            data-testid={`lang-${l}`}
            onClick={(e) => {
              e.preventDefault();
              choose(l);
            }}
            className={cn(
              "press inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition-colors",
              on ? "border-primary bg-primary-soft text-primary-ink" : "border-border bg-card text-foreground hover:border-primary/50",
            )}
          >
            {NATIVE[l].name}
          </a>
        );
      })}
    </nav>
  );
}
