import { z } from "zod";
import { publicEnv } from "@/lib/env-public";

/**
 * Kirish ekranlaridagi rasmlar (T4): admin panelda ("Kirish ekranlari") har biri alohida yuklanadi va almashtiriladi.
 * Saqlanadi: app_settings.entry_media (ochiq o'qiladi) — { slot: "site-media/entry/v-<sha256>.webp" | null }.
 * Fayl serverda tekshiriladi va metama'lumotsiz WebP qilib qayta kodlanadi (bosh sahifa oynalari bilan bir xil yo'l).
 * Rasm yuklanmagan joyda — o'rnatilgan brend tasviri (tarmoqsiz, darhol).
 */
export const ENTRY_MEDIA_KEY = "entry_media";

export const ENTRY_SLOTS = ["intro_jobs", "intro_workers", "intro_ai", "role_worker", "role_employer"] as const;
export type EntrySlot = (typeof ENTRY_SLOTS)[number];

/** Admin va hujjat uchun: tavsiya etilgan nisbat va o'lcham (ekranda shu nisbatda kesiladi) */
export const SLOT_SPEC: Record<EntrySlot, { ratio: "4:3" | "1:1"; size: string }> = {
  intro_jobs: { ratio: "4:3", size: "1200×900" },
  intro_workers: { ratio: "4:3", size: "1200×900" },
  intro_ai: { ratio: "4:3", size: "1200×900" },
  role_worker: { ratio: "1:1", size: "800×800" },
  role_employer: { ratio: "1:1", size: "800×800" },
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
