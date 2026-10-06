/** uz — o'zbek lotin, oz — o'zbek kirill (gov.uz uslubida), ru, en */
export const LOCALES = ["uz", "oz", "ru", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "uz";
export const LOCALE_COOKIE = "ishuz_locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export const LOCALE_LABELS: Record<Locale, string> = { uz: "UZ", oz: "ЎЗ", ru: "RU", en: "EN" };

/** Intl formatlash uchun BCP-47 teglari */
export const INTL_LOCALE: Record<Locale, string> = { uz: "uz-Latn-UZ", oz: "uz-Cyrl-UZ", ru: "ru-RU", en: "en-US" };
