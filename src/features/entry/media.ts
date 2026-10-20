import { z } from "zod";
import { publicEnv } from "@/lib/env-public";

/**
 * Kirish ekranlaridagi rasmlar (T4) va bosh ekran sarlavhalarining fon suratlari (premium 2026-10): admin panelda
 * ("Kirish ekranlari") har biri alohida yuklanadi va almashtiriladi.
 * Bosh sahifalardagi katta rasmli plitkalar 2026-10 redizaynida olib tashlandi (bo'limlar — ixcham ro'yxat), ularning rasm
 * joylari ham yo'q; bazada eski qiymat qolgan bo'lsa — e'tiborsiz qoldiriladi.
 * Saqlanadi: app_settings.entry_media (ochiq o'qiladi) — { slot: "site-media/entry/v-<sha256>.webp" | null }.
 * Fayl serverda tekshiriladi va metama'lumotsiz WebP qilib qayta kodlanadi (bosh sahifa oynalari bilan bir xil yo'l).
 * Rasm yuklanmagan joyda — o'rnatilgan brend tasviri (tarmoqsiz, darhol).
 */
export const ENTRY_MEDIA_KEY = "entry_media";

export const ENTRY_SLOTS = [
  "intro_jobs",
  "intro_workers",
  "intro_ai",
  "role_worker",
  "role_employer",
  "hero_seeker",
  "hero_employer",
  "hero_guest",
] as const;
export type EntrySlot = (typeof ENTRY_SLOTS)[number];

/** Admin sahifasidagi guruhlar (har joy — bitta guruhda) */
export const SLOT_GROUPS = {
  // bosh ekran sarlavhalarining fon surati (premium 2026-10): yuklanmasa — ko'k brend sirti
  hero: ["hero_seeker", "hero_employer", "hero_guest"],
  entry: ["intro_jobs", "intro_workers", "intro_ai", "role_worker", "role_employer"],
} as const satisfies Record<string, readonly EntrySlot[]>;

/** Admin va hujjat uchun: tavsiya etilgan nisbat va o'lcham (ekranda shu nisbatda kesiladi) */
export const SLOT_SPEC: Record<EntrySlot, { ratio: "4:3" | "1:1" | "16:9"; size: string }> = {
  intro_jobs: { ratio: "4:3", size: "1200×900" },
  intro_workers: { ratio: "4:3", size: "1200×900" },
  intro_ai: { ratio: "4:3", size: "1200×900" },
  role_worker: { ratio: "1:1", size: "800×800" },
  role_employer: { ratio: "1:1", size: "800×800" },
  hero_seeker: { ratio: "16:9", size: "1920×1080" },
  hero_employer: { ratio: "16:9", size: "1920×1080" },
  hero_guest: { ratio: "16:9", size: "1920×1080" },
};

const PATH_RE = /^site-media\/entry\/v-[0-9a-f]{64}\.webp$/;

export const entryMediaSchema = z.object(
  Object.fromEntries(ENTRY_SLOTS.map((s) => [s, z.string().regex(PATH_RE).nullable().optional()])) as Record<EntrySlot, z.ZodOptional<z.ZodNullable<z.ZodString>>>,
);
export type EntryMedia = Partial<Record<EntrySlot, string | null>>;

/** Bazadagi qiymat → rasmlar; yaroqsiz yoki yo'q — bo'sh (hammasi o'rnatilgan tasvir) */
export function parseEntryMedia(value: unknown): EntryMedia {
  const parsed = entryMediaSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

export function isEntryMediaPath(path: string): boolean {
  return PATH_RE.test(path);
}

/** Ommaviy storage manzili (faqat o'z bucket'imiz — tashqi URL qabul qilinmaydi) */
export function entryMediaUrl(path: string | null | undefined): string | null {
  if (!path || !PATH_RE.test(path)) return null;
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${path}`;
}
