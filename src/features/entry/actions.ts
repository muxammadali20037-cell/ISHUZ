"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prefCookie } from "@/lib/security/cookies";
import { safeInternalPath } from "@/lib/security/safe-path";
import { LOCALES, LOCALE_COOKIE } from "@/lib/i18n/config";
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

/**
 * Xush kelibsiz ekrani (2.0): rol tanlandi — til (tanlanmagan bo'lsa joriy sahifa tili) va "tanishtiruv o'tilgan" belgisi
 * saqlanadi, rejim (chooseMode) qo'yiladi va rolning bosh sahifasiga o'tiladi. Kirish talab qilinmaydi. JS'siz ham ishlaydi.
 */
export async function pickWelcomeRole(form: FormData): Promise<void> {
  const mode = z.enum(["worker", "employer"]).safeParse(form.get("mode"));
  if (!mode.success) redirect("/start/til");
  const jar = await cookies();
  if (!jar.get(LOCALE_COOKIE)?.value) {
    const locale = z.enum(LOCALES).safeParse(form.get("locale"));
    await setLocale(locale.success ? locale.data : "uz");
  }
  const res = await chooseMode(mode.data);
  if (!res.ok) redirect("/start/til?error=1");
  jar.set(INTRO_COOKIE, "1", prefCookie(YEAR));
  // kirgan, lekin profili yo'q foydalanuvchi — oqim davom etadi (profil); mehmon — darhol bosh sahifa
  const session = await getSession();
  if (session && !session.workerOnboarded && !session.employerOnboarded) {
    await markInFlow();
    redirect(resumeTo(form));
  }
  jar.delete(ENTRY_COOKIE);
  const next = form.get("next");
  redirect(safeInternalPath(typeof next === "string" ? next : null, "") || dashboardPath(mode.data, !!session?.employerOnboarded));
}

/** Tanishtiruv tugadi yoki o'tkazib yuborildi — shundagina "ko'rilgan" deb belgilanadi (oyna ochilishi emas) */
export async function finishIntro(form: FormData): Promise<void> {
  const jar = await cookies();
  jar.set(INTRO_COOKIE, "1", prefCookie(YEAR));
  // 2.0: slaydlar ixtiyoriy ("Qanday ishlaydi?") — rol hali tanlanmagan bo'lsa, xush kelibsiz ekraniga (rol tanlash) qaytiladi
  if (!(await getMode())) redirect("/start/til");
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
