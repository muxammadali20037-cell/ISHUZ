import { latinToCyrillic } from "./translit";
import type { Locale } from "./config";

/**
 * Tarjima yadrosi — tarjima fayllarini import QILMAYDI (client bundle'ga barcha tillar tushmasligi uchun).
 * Server: translate.ts (makeT) barcha lug'atlardan foydalanadi; client: faqat joriy til lug'ati props orqali keladi.
 */
export type TranslateParams = Record<string, string | number | null | undefined>;
export type Dict = Record<string, unknown>;

function lookup(dict: Dict | undefined, key: string): string | undefined {
  let node: unknown = dict;
  for (const p of key.split(".")) {
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

/** Lug'atdan tarjima funksiyasi. Kalit topilmasa: zaxira lug'at → kalitning o'zi */
export function createT(dict: Dict, fallback?: Dict) {
  return function t(key: string, params?: TranslateParams): string {
    const value = lookup(dict, key) ?? lookup(fallback, key) ?? key;
    return interpolate(value, params);
  };
}

/** Enum qiymatini tarjima qiladi: tEnum('employment_type', 'full_time') */
export function makeTEnum(t: (key: string, params?: TranslateParams) => string) {
  return function tEnum(group: string, value: string | null | undefined): string {
    if (value === null || value === undefined || value === "") return "";
    return t(`enums.${group}.${value}`);
  };
}

/** Ma'lumotnoma yozuvlaridagi name_uz / name_ru / name_en dan tilga mos nomni oladi (ingliz nomi bo'lmasa — o'zbekcha) */
export function localizedName(locale: Locale, row: { name_uz: string; name_ru: string; name_en?: string | null; name_oz?: string | null } | null | undefined): string {
  if (!row) return "";
  if (locale === "ru") return row.name_ru;
  if (locale === "en") return row.name_en || row.name_uz;
  if (locale === "oz") return row.name_oz || latinToCyrillic(row.name_uz);
  return row.name_uz;
}
