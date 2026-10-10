"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "./config";
import { createT, makeTEnum, localizedName, type Dict } from "./core";
import type { TFunction } from "./translate";

type I18nContextValue = {
  locale: Locale;
  t: TFunction;
  tEnum: ReturnType<typeof makeTEnum>;
  name: (row: { name_uz: string; name_ru: string; name_en?: string | null; name_oz?: string | null } | null | undefined) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Tarjimalar: serverdan faqat joriy til lug'ati keladi (barcha tillar client bundle'ga tushmaydi).
 * Admin panel o'z bo'limi bilan ichki provider qo'yadi.
 */
export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Dict; children: ReactNode }) {
  const value = useMemo<I18nContextValue>(() => {
    const t = createT(messages) as TFunction;
    return { locale, t, tEnum: makeTEnum(t), name: (row) => localizedName(locale, row) };
  }, [locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Client komponentlarda: const { t, locale } = useT() */
export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT() I18nProvider ichida chaqirilishi kerak");
  return ctx;
}
