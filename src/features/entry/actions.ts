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
import { createClient } from "@/lib/supabase/server";
import { getDistricts, getRegions } from "@/lib/reference";
import { PLACE_COOKIE, formatPlace } from "@/features/find/place";
import { PREFS_COOKIE, cleanProfessionIds, formatPrefs, isExperienceLevel, parsePrefs } from "./prefs";

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
  const next = safeInternalPath(typeof form.get("next") === "string" ? (form.get("next") as string) : null, "");
  if (next) redirect(next);
  // 4.0: ish qidiruvchi — 05 kasblar va 06 hudud (ixtiyoriy, "O'tkazib yuborish" bor), keyin bosh sahifa
  redirect(mode.data === "worker" ? "/start/kasblar" : dashboardPath(mode.data, !!session?.employerOnboarded));
}

const HALF_YEAR = 60 * 60 * 24 * 180;

/**
 * 05 · "Qaysi kasblar sizga mos keladi?": 5 tagacha kasb (faol va tanlanadigan tugunlar — bazadan tekshiriladi) shu qurilmada
 * eslab qolinadi; bosh sahifadagi "Sizga mos ishlar" shular bo'yicha (profilda kasb bo'lmasa). Keyin — 06 hudud.
 */
export async function saveProfessionPrefs(form: FormData): Promise<void> {
  const ids = cleanProfessionIds(form.getAll("p"));
  let valid: string[] = [];
  if (ids.length) {
    const supabase = await createClient();
    const { data } = await supabase.from("profession_nodes").select("id").in("id", ids).eq("is_active", true).eq("selectable", true);
    const ok = new Set((data ?? []).map((r) => r.id));
    valid = ids.filter((id) => ok.has(id));
  }
  const jar = await cookies();
  const prefs = parsePrefs(jar.get(PREFS_COOKIE)?.value);
  jar.set(PREFS_COOKIE, formatPrefs({ ...prefs, professions: valid }), prefCookie(HALF_YEAR));
  redirect("/start/hudud");
}

/**
 * 06 · "Qayerda ishlashni istaysiz?": viloyat va tuman — mavjud hudud cookie'siga (bosh sahifa va qidiruv shuni o'qiydi;
 * "Butun O'zbekiston" — o'chiriladi), "masofaviy ham mos" va tajriba — tanlov cookie'siga. Keyin — bosh sahifa.
 */
export async function saveRegionPrefs(form: FormData): Promise<void> {
  const jar = await cookies();
  const regionSlug = form.get("region");
  const districtId = form.get("district");
  const [regions, districts] = await Promise.all([getRegions(), getDistricts()]);
  const region = typeof regionSlug === "string" ? regions.find((r) => r.slug === regionSlug) : undefined;
  if (region) {
    const district = typeof districtId === "string" ? districts.find((d) => d.id === districtId && d.region_id === region.id) : undefined;
    jar.set(PLACE_COOKIE, formatPlace({ region: region.slug, district: district?.id ?? "all" }), prefCookie(HALF_YEAR));
  } else if (regionSlug === "all") {
    jar.delete(PLACE_COOKIE);
  }
  const experience = form.get("experience");
  const prefs = parsePrefs(jar.get(PREFS_COOKIE)?.value);
  jar.set(
    PREFS_COOKIE,
    formatPrefs({ ...prefs, remote: form.get("remote") === "1", experience: isExperienceLevel(experience) ? experience : null }),
    prefCookie(HALF_YEAR),
  );
  redirect("/");
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
