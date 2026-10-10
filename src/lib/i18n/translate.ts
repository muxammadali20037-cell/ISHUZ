import { messages, type MessageKey } from "./messages";
import type { Locale } from "./config";
import { createT, type Dict, type TranslateParams } from "./core";

export { makeTEnum, localizedName } from "./core";
export type { TranslateParams } from "./core";

/** Tarjima funksiyasini yaratadi (server: barcha lug'atlar). Kalit topilmasa: uz → kalitning o'zi. */
export function makeT(locale: Locale) {
  const t = createT(messages[locale] as Dict, messages.uz as Dict);
  return function translate(key: MessageKey | (string & {}), params?: TranslateParams): string {
    return t(key, params);
  };
}

export type TFunction = ReturnType<typeof makeT>;

/** Brauzerga yuboriladigan lug'at: faqat joriy til; server/admin bo'limlarisiz (admin panel o'zinikini qo'shadi) */
const SERVER_ONLY_NAMESPACES = new Set(["admin", "legal", "bot", "cv"]);
export function clientMessages(locale: Locale, opts: { admin?: boolean } = {}): Dict {
  const all = messages[locale] as Dict;
  return Object.fromEntries(Object.entries(all).filter(([ns]) => !SERVER_ONLY_NAMESPACES.has(ns) || (opts.admin && ns === "admin")));
}
