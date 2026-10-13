import { z } from "zod";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { isSafeInternalPath } from "@/lib/security/safe-path";

/**
 * Bosh sahifa tepasidagi rasmli oynalar (my.gov.uz uslubida): rasm, ostida nomi va qisqa izoh, bosilganda ichki sahifa.
 * Sozlama: app_settings.home_banners (0060). null yoki noto'g'ri qiymat — standart oynalar.
 * Har oyna bitta rejim uchun (audience): ish izlovchi faqat o'zinikini, ish beruvchi faqat o'zinikini ko'radi.
 * Matn berilmagan tilda — standart oynaning tarjimasi (messages: easy.home.windows.<id>), u ham bo'lmasa — o'zbekcha.
 */
export const WINDOW_ART = ["workers", "jobs", "daily", "near", "post"] as const;
export type WindowArt = (typeof WINDOW_ART)[number];

/** O'rnatilgan oynalar (tarjimasi messages'da bor) */
export const BUILTIN_WINDOWS = ["jobs", "daily", "near_jobs", "workers", "near_workers", "post_vacancy"] as const;
export type BuiltinWindow = (typeof BUILTIN_WINDOWS)[number];

export const WINDOW_AUDIENCES = ["worker", "employer", "all"] as const;
export type WindowAudience = (typeof WINDOW_AUDIENCES)[number];

const text = z.object(Object.fromEntries(LOCALES.map((l) => [l, z.string().trim().max(80).optional()])) as Record<Locale, z.ZodOptional<z.ZodString>>);
const desc = z.object(Object.fromEntries(LOCALES.map((l) => [l, z.string().trim().max(140).optional()])) as Record<Locale, z.ZodOptional<z.ZodString>>);

export const homeWindowSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{2,40}$/),
  enabled: z.boolean(),
  /** o'rnatilgan rasm (illyustratsiya); `image` bo'lsa — u ko'rsatiladi */
  art: z.enum(WINDOW_ART).nullable(),
  /** admin yuklagan rasm: faqat o'z storage'imiz (site-media), server qayta kodlagan WebP */
  image: z.string().regex(/^site-media\/windows\/v-[0-9a-f]{64}\.webp$/).nullable(),
  href: z.string().max(300).refine(isSafeInternalPath, "internal_path"),
  /** kimga ko'rinadi; eski yozuvlarda yo'q — havoladan aniqlanadi (windowAudience) */
  audience: z.enum(WINDOW_AUDIENCES).optional(),
  title: text,
  desc,
});
export type HomeWindow = z.infer<typeof homeWindowSchema>;
export const MAX_WINDOWS = 12;
export const homeWindowsSchema = z.array(homeWindowSchema).max(MAX_WINDOWS);

export const DEFAULT_WINDOWS: HomeWindow[] = [
  { id: "jobs", enabled: true, art: "jobs", image: null, href: "/search?mode=jobs", audience: "worker", title: {}, desc: {} },
  { id: "daily", enabled: true, art: "daily", image: null, href: "/search?mode=jobs&pay=daily", audience: "worker", title: {}, desc: {} },
  { id: "near_jobs", enabled: true, art: "near", image: null, href: "/search?mode=jobs&near=1", audience: "worker", title: {}, desc: {} },
  { id: "workers", enabled: true, art: "workers", image: null, href: "/search?mode=workers", audience: "employer", title: {}, desc: {} },
  { id: "near_workers", enabled: true, art: "near", image: null, href: "/search?mode=workers&near=1", audience: "employer", title: {}, desc: {} },
  { id: "post_vacancy", enabled: true, art: "post", image: null, href: "/post/vacancy", audience: "employer", title: {}, desc: {} },
];

/** Oyna kimga: berilgan bo'lsa — o'sha; aks holda havoladan (ish qidirish/o'zi haqida e'lon → ish izlovchi; ishchilar/vakansiya → ish beruvchi) */
export function windowAudience(w: Pick<HomeWindow, "href" | "audience">): WindowAudience {
  if (w.audience) return w.audience;
  const href = w.href;
  if (/[?&]mode=jobs\b/.test(href) || href.startsWith("/post/worker") || href.startsWith("/jobs")) return "worker";
  if (/[?&]mode=workers\b/.test(href) || href.startsWith("/post/vacancy") || href.startsWith("/workers")) return "employer";
  return "all";
}

/** Shu rejimda ko'rinadigan oynalar (tartib saqlanadi) */
export function windowsFor(mode: "worker" | "employer", windows: HomeWindow[]): HomeWindow[] {
  return windows.filter((w) => w.enabled && (windowAudience(w) === "all" || windowAudience(w) === mode));
}

/** Bazadagi qiymat → oynalar (yaroqsiz bo'lsa — standart) */
export function parseWindows(value: unknown): HomeWindow[] {
  const parsed = homeWindowsSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_WINDOWS;
}

export function isBuiltinWindow(id: string): id is BuiltinWindow {
  return (BUILTIN_WINDOWS as readonly string[]).includes(id);
}
