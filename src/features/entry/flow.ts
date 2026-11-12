import { safeInternalPath } from "@/lib/security/safe-path";
import type { AppMode } from "@/features/mode/mode";

/**
 * Kirish oqimi (2.0): yangi foydalanuvchi — BITTA xush kelibsiz ekrani (til + rol, rasmlar bilan) → o'z rolining bosh sahifasi.
 * Kirish — faqat kerak bo'lganda (e'lon berish, ariza): rol → kirish usuli → telefon/kod → profil → "Profilingiz tayyor!".
 * Tanishtiruv slaydlari (/start/tanishtiruv) ixtiyoriy — xush kelibsiz ekranidagi "Qanday ishlaydi?" havolasi. Qaysi qadam kerakligini faqat shu funksiya hal qiladi (bosh sahifa, /start, kirishdan keyin):
 * redirect sikli va qayta-qayta tanishtiruv bo'lmasligi uchun bitta joyda.
 *
 * - Qaytgan foydalanuvchi (kamida bitta roli tayyor) — hech qanday qadamsiz bosh sahifaga.
 * - Qidiruv robotlari — hech qachon (sahifa mazmuni darhol).
 * - Mehmon kirishga majburlanmaydi: bosh sahifa va e'lonlar ochiq; kirish — o'zi xohlaganda.
 * - Kirgan, lekin profili hali yo'q foydalanuvchi oqimga faqat uni boshlagan bo'lsa qaytariladi (ENTRY_COOKIE) — masalan,
 *   vakansiyadan tezkor ariza bergan odamni bosh sahifada profil to'ldirishga majburlamaymiz.
 */

/** Oqim boshlangan (til yoki rol tanlangan), "Profilingiz tayyor!" ekranida o'chiriladi */
export const ENTRY_COOKIE = "ib_entry";

/** Qidiruv robotlari va havola ko'rib chiquvchilar */
export const BOT_UA = /bot|crawl|spider|slurp|lighthouse|facebookexternalhit|preview|embedly|whatsapp|vkshare/i;

/** "welcome" (2.0, 2026-11): til va rol — BITTA ekranda (/start/til); tanishtiruv slaydlari ixtiyoriy ("Qanday ishlaydi?") */
export type EntryStep = "welcome" | "login" | "role" | "profile" | "done";

export interface EntryState {
  bot: boolean;
  /** til cookie'si bor (foydalanuvchi tanlagan yoki kirishda profildan yozilgan) */
  localeChosen: boolean;
  /** xush kelibsiz ekrani o'tilgan (rol tanlangan) yoki tanishtiruv ko'rilgan / o'tkazib yuborilgan */
  introDone: boolean;
  mode: AppMode | null;
  session: { workerOnboarded: boolean; employerOnboarded: boolean } | null;
  /** oqim boshlangan (ENTRY_COOKIE) */
  inFlow: boolean;
}

/** Hali birorta roli tayyor emas — oqim faqat shunday foydalanuvchi uchun */
export function isNewcomer(s: Pick<EntryState, "session">): boolean {
  return !s.session || (!s.session.workerOnboarded && !s.session.employerOnboarded);
}

export function nextEntryStep(s: EntryState): EntryStep {
  if (s.bot || !isNewcomer(s)) return "done";
  // birinchi ochilish: til + rol bitta ekranda; u o'tilgach (introDone) mehmon bosh sahifaga, kirgan — profilga
  if (!s.introDone) return "welcome";
  if (!s.session) return "login";
  if (!s.mode) return "role";
  return "profile";
}

/**
 * Bosh sahifa ("/") ochilganda: oqimning qaysi qadamiga o'tkazish kerak (null — bosh sahifaning o'zi).
 * Til va tanishtiruv — faqat birinchi ochilishda; kirgan, oqimni boshlagan, lekin tugatmagan — to'xtagan qadamiga.
 */
export function homeEntryStep(s: EntryState): EntryStep | null {
  const step = nextEntryStep(s);
  if (step === "welcome") return step;
  if (s.session && s.inFlow && (step === "role" || step === "profile")) return step;
  return null;
}

/** Oqim tugagach (yoki kerak bo'lmasa) — rolning bosh sahifasi yoki kelgan manzil */
export function dashboardPath(mode: AppMode | null, employerOnboarded: boolean): string {
  return mode === "employer" && employerOnboarded ? "/employer" : "/";
}

/** Profil tugagach ko'rsatiladigan ekran (bir marta — faqat profil yaratish yakunidan) */
export const SUCCESS_PATH = "/start/tayyor";

/** Qadam → manzil. `next` — oqim tugagach qaytiladigan joy (faqat shu saytdagi yo'l) */
export function entryPath(step: EntryStep, ctx: { mode: AppMode | null; employerOnboarded?: boolean; next?: string | null }): string {
  const next = safeInternalPath(ctx.next ?? null, "") || null;
  const resume = next ? `/start?next=${encodeURIComponent(next)}` : "/start";
  switch (step) {
    case "welcome":
      return "/start/til";
    case "login":
      return `/auth?next=${encodeURIComponent(resume)}`;
    case "role":
      return next ? `/start/rol?next=${encodeURIComponent(resume)}` : "/start/rol";
    case "profile":
      return `${ctx.mode === "employer" ? "/onboarding/employer" : "/onboarding/worker"}?next=${encodeURIComponent(SUCCESS_PATH)}`;
    case "done":
      return next ?? dashboardPath(ctx.mode, ctx.employerOnboarded ?? false);
  }
}
