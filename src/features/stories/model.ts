import { z } from "zod";
import { publicEnv } from "@/lib/env-public";

/**
 * "Ish Topdim" hikoyalari (0079): bosh sahifa tepasidagi doirachalar — bosilsa, Instagram'dagidek to'liq ekranda rasm yoki
 * video, xohlasa pastida reklama tugmasi. Faqat admin joylaydi (foydalanuvchi hikoyasi yo'q). Sof funksiyalar — server va
 * brauzer uchun umumiy.
 */
export type StoryAudience = "all" | "seeker" | "employer";
export type StoryKind = "image" | "video";

export interface Story {
  id: string;
  title: string;
  caption: string | null;
  kind: StoryKind;
  mediaUrl: string;
  /** doiracha va video yuklanguncha ko'rinadigan rasm; rasmli hikoyada — rasmning o'zi */
  posterUrl: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  /** rasm necha soniya turadi (video — o'z uzunligicha) */
  durationSec: number;
}

export interface StoryRow {
  id: string;
  title: string;
  caption: string | null;
  media_kind: string;
  media_path: string;
  poster_path: string | null;
  cta_label: string | null;
  cta_url: string | null;
  audience: string;
  duration_sec: number;
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
  sort_order: number;
  created_at: string;
}

export const IMAGE_PATH_RE = /^site-media\/stories\/v-[0-9a-f]{64}\.webp$/;
export const VIDEO_PATH_RE = /^story-videos\/v\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|webm|mov)$/;

/** Admin tanlashi mumkin bo'lgan video turlari → kengaytma */
export const VIDEO_TYPES = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" } as const;
export type VideoExt = (typeof VIDEO_TYPES)[keyof typeof VIDEO_TYPES];
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

/** Ommaviy storage manzili — faqat o'z bucket'larimizdagi tekshirilgan yo'llar (tashqi URL qabul qilinmaydi) */
export function storyMediaUrl(path: string | null | undefined): string | null {
  if (!path || !(IMAGE_PATH_RE.test(path) || VIDEO_PATH_RE.test(path))) return null;
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${path}`;
}

/** Reklama tugmasi havolasi: sayt ichidagi yo'l (/…, lekin //… emas) yoki https. javascript:, data:, http: — yo'q */
export function isSafeCtaUrl(url: string): boolean {
  if (url.length > 500 || /\s/.test(url)) return false;
  if (url === "/") return true;
  if (/^\/[^/\\]/.test(url)) return true;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !!u.hostname && !u.username && !u.password;
  } catch {
    return false;
  }
}

export function isInternalCta(url: string): boolean {
  return url === "/" || /^\/[^/\\]/.test(url);
}

/** Hozir ko'rinadimi: yoqilgan va muddati ichida (kesh eskirgan bo'lsa ham — har ko'rsatishda qayta tekshiriladi) */
export function isLive(row: Pick<StoryRow, "is_active" | "starts_at" | "ends_at">, now = Date.now()): boolean {
  if (!row.is_active) return false;
  if (new Date(row.starts_at).getTime() > now) return false;
  return !row.ends_at || new Date(row.ends_at).getTime() > now;
}

/** Kimga ko'rinadi: "all" — hammaga; rejim tanlanmagan mehmonga — faqat "all" */
export function forAudience<T extends Pick<StoryRow, "audience">>(rows: T[], mode: "seeker" | "employer" | null): T[] {
  return rows.filter((r) => r.audience === "all" || (mode !== null && r.audience === mode));
}

export function toStory(row: StoryRow): Story | null {
  const kind: StoryKind | null = row.media_kind === "image" ? "image" : row.media_kind === "video" ? "video" : null;
  const mediaUrl = storyMediaUrl(row.media_path);
  if (!kind || !mediaUrl) return null;
  if (kind === "image" && !IMAGE_PATH_RE.test(row.media_path)) return null;
  if (kind === "video" && !VIDEO_PATH_RE.test(row.media_path)) return null;
  const cta = row.cta_label && row.cta_url && isSafeCtaUrl(row.cta_url) ? { ctaLabel: row.cta_label, ctaUrl: row.cta_url } : { ctaLabel: null, ctaUrl: null };
  return {
    id: row.id,
    title: row.title,
    caption: row.caption,
    kind,
    mediaUrl,
    posterUrl: kind === "image" ? mediaUrl : storyMediaUrl(row.poster_path),
    ...cta,
    durationSec: Math.min(30, Math.max(3, row.duration_sec || 7)),
  };
}

/**
 * Fayl haqiqatan video ekanini boshidagi baytlardan tekshirish (kengaytma va brauzer aytgan turga ishonilmaydi):
 * MP4/MOV — 4-baytdan "ftyp" (ba'zi eski MOV — "moov"/"mdat"/"wide"/"free"), WebM — EBML sarlavhasi 1A 45 DF A3.
 */
export function videoSignatureOk(head: Uint8Array, ext: VideoExt): boolean {
  if (head.length < 12) return false;
  if (ext === "webm") return head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3;
  const box = String.fromCharCode(head[4]!, head[5]!, head[6]!, head[7]!);
  if (ext === "mp4") return box === "ftyp";
  return ["ftyp", "moov", "mdat", "wide", "free"].includes(box);
}

const trimmed = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().max(max));

/** Admin formasi (yaratish/tahrirlash) */
export const storyInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: trimmed(40).pipe(z.string().min(1)),
    caption: trimmed(300).nullable().optional(),
    kind: z.enum(["image", "video"]),
    mediaPath: z.string(),
    posterPath: z.string().regex(IMAGE_PATH_RE).nullable().optional(),
    ctaLabel: trimmed(30).nullable().optional(),
    ctaUrl: z.string().trim().max(500).nullable().optional(),
    audience: z.enum(["all", "seeker", "employer"]),
    durationSec: z.number().int().min(3).max(30),
    /** necha kun turadi; null — muddatsiz */
    days: z.number().int().min(1).max(365).nullable(),
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "image" ? !IMAGE_PATH_RE.test(v.mediaPath) : !VIDEO_PATH_RE.test(v.mediaPath)) {
      ctx.addIssue({ code: "custom", path: ["mediaPath"], message: "media" });
    }
    const label = v.ctaLabel || null;
    const url = v.ctaUrl || null;
    if (!!label !== !!url) ctx.addIssue({ code: "custom", path: ["ctaUrl"], message: "cta_pair" });
    if (url && !isSafeCtaUrl(url)) ctx.addIssue({ code: "custom", path: ["ctaUrl"], message: "cta_url" });
  });
export type StoryInput = z.infer<typeof storyInputSchema>;

/** Ko'rilgan hikoyalar (shu qurilmada): doiracha halqasi kulrang bo'ladi, ko'rilmaganlar oldinda turadi */
export const SEEN_KEY = "ib_stories_seen";

export function orderBySeen<T extends { id: string }>(stories: T[], seen: ReadonlySet<string>): T[] {
  return [...stories.filter((s) => !seen.has(s.id)), ...stories.filter((s) => seen.has(s.id))];
}
