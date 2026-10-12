import { z } from "zod";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { isSafeInternalPath } from "@/lib/security/safe-path";

/**
 * Bosh sahifa tepasidagi rasmli oynalar (my.gov.uz uslubida): rasm, ostida nomi va qisqa izoh, bosilganda ichki sahifa.
 * Sozlama: app_settings.home_banners (0060). null yoki noto'g'ri qiymat — standart uchta oyna.
 * Matn berilmagan tilda — standart oynaning tarjimasi (messages: easy.home.windows.<id>), u ham bo'lmasa — o'zbekcha.
 */
export const WINDOW_ART = ["workers", "jobs", "daily"] as const;
export type WindowArt = (typeof WINDOW_ART)[number];

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
  title: text,
  desc,
});
export type HomeWindow = z.infer<typeof homeWindowSchema>;
export const homeWindowsSchema = z.array(homeWindowSchema).max(8);

export const DEFAULT_WINDOWS: HomeWindow[] = [
  { id: "workers", enabled: true, art: "workers", image: null, href: "/search?mode=workers", title: {}, desc: {} },
  { id: "jobs", enabled: true, art: "jobs", image: null, href: "/search?mode=jobs", title: {}, desc: {} },
  { id: "daily", enabled: true, art: "daily", image: null, href: "/search?mode=jobs&pay=daily", title: {}, desc: {} },
];

/** Bazadagi qiymat → oynalar (yaroqsiz bo'lsa — standart) */
export function parseWindows(value: unknown): HomeWindow[] {
  const parsed = homeWindowsSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_WINDOWS;
}

export function isBuiltinWindow(id: string): id is WindowArt {
  return (WINDOW_ART as readonly string[]).includes(id);
}
