"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prefCookie } from "@/lib/security/cookies";
import { safeInternalPath } from "@/lib/security/safe-path";
import { LOCALES } from "@/lib/i18n/config";
import { setLocale } from "@/features/auth/actions";
import { chooseMode } from "@/features/mode/actions";
import { getSession } from "@/features/auth/session";
import { getMode } from "@/features/mode/server";
import { INTRO_COOKIE } from "@/features/intro/intro";
import { ENTRY_COOKIE, dashboardPath } from "./flow";

const YEAR = 60 * 60 * 24 * 365;
const MONTH = 60 * 60 * 24 * 30;

async function markInFlow() {
  (await cookies()).set(ENTRY_COOKIE, "1", prefCookie(MONTH));
}

/** Oqim davom etadigan joy: faqat shu saytdagi yo'l, aks holda — /start (u keyingi qadamni o'zi hal qiladi) */
function resumeTo(form: FormData): string {
  const next = form.get("next");
  return safeInternalPath(typeof next === "string" ? next : null, "") || "/start";
}

/** 2-ekran: til (cookie + kirgan bo'lsa profil) → tanishtiruv. JS'siz ham ishlaydi */
export async function pickLanguage(form: FormData): Promise<void> {
  const locale = z.enum(LOCALES).safeParse(form.get("locale"));
  if (!locale.success) redirect("/start/til");
  await setLocale(locale.data);
  await markInFlow();
  redirect(resumeTo(form));
}

/** Tanishtiruv tugadi yoki o'tkazib yuborildi — shundagina "ko'rilgan" deb belgilanadi (oyna ochilishi emas) */
export async function finishIntro(form: FormData): Promise<void> {
  const jar = await cookies();
  jar.set(INTRO_COOKIE, "1", prefCookie(YEAR));
  await markInFlow();
  redirect(resumeTo(form));
}

/** 7-ekran: rol (qurilma cookie'si + kirgan bo'lsa profiles.active_role — mavjud chooseMode) */
export async function pickRole(form: FormData): Promise<void> {
  const mode = z.enum(["worker", "employer"]).safeParse(form.get("mode"));
  const back = form.get("next");
  if (!mode.success) redirect(`/start/rol${typeof back === "string" && back ? `?next=${encodeURIComponent(back)}` : ""}`);
  const res = await chooseMode(mode.data);
  if (!res.ok) redirect(`/start/rol?error=1${typeof back === "string" && back ? `&next=${encodeURIComponent(back)}` : ""}`);
  await markInFlow();
  redirect(resumeTo(form));
}

/** 11-ekran: "Bosh sahifaga o'tish" — oqim yopiladi, rolning bosh sahifasi */
export async function finishEntry(): Promise<void> {
  (await cookies()).delete(ENTRY_COOKIE);
  const [session, mode] = await Promise.all([getSession(), getMode()]);
  redirect(dashboardPath(mode, !!session?.employerOnboarded));
}
