import "server-only";

import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { getSession } from "@/features/auth/session";
import { getMode } from "@/features/mode/server";
import { INTRO_COOKIE } from "@/features/intro/intro";
import { BOT_UA, ENTRY_COOKIE, type EntryState } from "./flow";

/** Joriy so'rov bo'yicha oqim holati: cookie'lar, sessiya, rejim, robotmi */
export async function getEntryState(): Promise<EntryState> {
  const [jar, head, session, mode] = await Promise.all([cookies(), headers(), getSession(), getMode()]);
  return {
    bot: BOT_UA.test(head.get("user-agent") ?? ""),
    localeChosen: !!jar.get(LOCALE_COOKIE)?.value,
    introDone: !!jar.get(INTRO_COOKIE)?.value,
    mode,
    session: session ? { workerOnboarded: session.workerOnboarded, employerOnboarded: session.employerOnboarded } : null,
    inFlow: !!jar.get(ENTRY_COOKIE)?.value,
  };
}
