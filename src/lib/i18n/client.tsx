"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "./config";
import { makeT, makeTEnum, localizedName, type TFunction } from "./translate";

type I18nContextValue = {
  locale: Locale;
  t: TFunction;
  tEnum: ReturnType<typeof makeTEnum>;
  name: (row: { name_uz: string; name_ru: string; name_en?: string | null; name_oz?: string | null } | null | undefined) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<I18nContextValue>(() => {
    const t = makeT(locale);
    return { locale, t, tEnum: makeTEnum(t), name: (row) => localizedName(locale, row) };
  }, [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Client komponentlarda: const { t, locale } = useT() */
export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT() I18nProvider ichida chaqirilishi kerak");
  return ctx;
}
