import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n/config";

/** "/jobs?category=x" + lang=ru → "/jobs?category=x&lang=ru" */
export function withLang(path: string, locale: Locale): string {
  if (locale !== "ru") return path;
  return `${path}${path.includes("?") ? "&" : "?"}lang=ru`;
}

/**
 * Til versiyalari (hreflang): o'zbekcha — asosiy URL, ruscha — ?lang=ru.
 * Canonical joriy tilga mos: ruscha sahifa o'zbekchaning dublikati deb hisoblanmaydi.
 */
export function localeAlternates(path: string, locale: Locale): NonNullable<Metadata["alternates"]> {
  return {
    canonical: withLang(path, locale),
    languages: { uz: path, ru: withLang(path, "ru"), "x-default": path },
  };
}
