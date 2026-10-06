import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n/config";

/** "/jobs?category=x" + lang=ru → "/jobs?category=x&lang=ru" */
export function withLang(path: string, locale: Locale): string {
  if (locale === "uz") return path;
  return `${path}${path.includes("?") ? "&" : "?"}lang=${locale}`;
}

/**
 * Til versiyalari (hreflang): o'zbekcha — asosiy URL, ruscha — ?lang=ru, inglizcha — ?lang=en.
 * Canonical joriy tilga mos: ruscha sahifa o'zbekchaning dublikati deb hisoblanmaydi.
 */
export function localeAlternates(path: string, locale: Locale): NonNullable<Metadata["alternates"]> {
  return {
    canonical: withLang(path, locale),
    languages: { uz: path, "uz-Cyrl": withLang(path, "oz"), ru: withLang(path, "ru"), en: withLang(path, "en"), "x-default": path },
  };
}
