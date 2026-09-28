import { messages, type MessageKey } from "./messages";
import type { Locale } from "./config";

export type TranslateParams = Record<string, string | number | null | undefined>;

function lookup(locale: Locale, key: string): string | undefined {
  const parts = key.split(".");
  let node: unknown = messages[locale];
  for (const p of parts) {
    if (node && typeof node === "object" && p in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof node === "string" ? node : undefined;
}

function interpolate(template: string, params?: TranslateParams) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = params[name];
    return v === null || v === undefined ? "" : String(v);
  });
}

/** Tarjima funksiyasini yaratadi. Kalit topilmasa: uz → kalitning o'zi (dev'da ko'rinib qoladi). */
export function makeT(locale: Locale) {
  return function t(key: MessageKey | (string & {}), params?: TranslateParams): string {
    const value = lookup(locale, key) ?? lookup("uz", key) ?? key;
    return interpolate(value, params);
  };
}

export type TFunction = ReturnType<typeof makeT>;

/** Enum qiymatini tarjima qiladi: tEnum('employment_type', 'full_time') */
export function makeTEnum(t: TFunction) {
  return function tEnum(group: string, value: string | null | undefined): string {
    if (value === null || value === undefined || value === "") return "";
    return t(`enums.${group}.${value}`);
  };
}

/** Ma'lumotnoma yozuvlaridagi name_uz / name_ru / name_en dan tilga mos nomni oladi (ingliz nomi bo'lmasa — o'zbekcha) */
export function localizedName(locale: Locale, row: { name_uz: string; name_ru: string; name_en?: string | null } | null | undefined): string {
  if (!row) return "";
  if (locale === "ru") return row.name_ru;
  if (locale === "en") return row.name_en || row.name_uz;
  return row.name_uz;
}
