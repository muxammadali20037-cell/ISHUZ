import "server-only";

import { cookies, headers } from "next/headers";
import { cache } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { makeT, makeTEnum, localizedName } from "./translate";

/** Joriy til: cookie → Accept-Language → uz. Profil tili login paytida cookie'ga yoziladi. */
export const getLocale = cache(async (): Promise<Locale> => {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const accept = (await headers()).get("accept-language") ?? "";
  if (/^ru\b/i.test(accept) || /,\s*ru\b/i.test(accept.split(";")[0] ?? "")) return "ru";
  return DEFAULT_LOCALE;
});

/** Server komponentlarda: const { t, locale } = await getT() */
export async function getT() {
  const locale = await getLocale();
  const t = makeT(locale);
  return { t, tEnum: makeTEnum(t), locale, name: (row: { name_uz: string; name_ru: string; name_en?: string | null; name_oz?: string | null } | null | undefined) => localizedName(locale, row) };
}
