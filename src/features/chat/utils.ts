import type { Json } from "@/types/database.types";
import { attachmentMetaSchema } from "./schema";
import type { AttachmentMeta, ChatMessage, MessageRow } from "./types";

export const CHAT_TZ = "Asia/Tashkent";

export function parseAttachmentMeta(json: Json | null | undefined): AttachmentMeta | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const parsed = attachmentMetaSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

export function rowToMessage(row: MessageRow, signedUrl: string | null = null): ChatMessage {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    type: row.type,
    body: row.body,
    attachment_path: row.attachment_path,
    attachment_meta: parseAttachmentMeta(row.attachment_meta),
    lat: row.lat,
    lng: row.lng,
    created_at: row.created_at,
    deleted_at: row.deleted_at,
    signed_url: signedUrl,
  };
}

/** ISO → "2026-09-26" (Toshkent kuni) */
export function dayKey(iso: string, tz = CHAT_TZ): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export interface DayGroup<T> {
  key: string;
  items: T[];
}

/** Xabarlarni (created_at bo'yicha tartiblangan) kunlarga ajratadi */
export function groupByDay<T extends { created_at: string }>(items: T[], tz = CHAT_TZ): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const key = dayKey(item.created_at, tz);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, items: [item] });
  }
  return groups;
}

/** Kun kaliti → "today" | "yesterday" | null (Toshkent vaqti bo'yicha) */
export function relativeDay(key: string, now = new Date(), tz = CHAT_TZ): "today" | "yesterday" | null {
  const today = dayKey(now.toISOString(), tz);
  if (key === today) return "today";
  const y = new Date(now.getTime() - 86_400_000);
  if (key === dayKey(y.toISOString(), tz)) return "yesterday";
  return null;
}

/** 1536 → "1.5 KB" */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 75 → "1:15" */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return "0:00";
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** send_message RPC yozadigan preview belgilarini turga aylantiradi */
export function previewKind(preview: string | null | undefined): "image" | "document" | "location" | "voice" | "text" | "empty" {
  if (!preview) return "empty";
  const s = preview.trim();
  if (s === "📷") return "image";
  if (s === "📎") return "document";
  if (s === "📍") return "location";
  if (s === "🎤") return "voice";
  return "text";
}

/** Fayl kengaytmasi (nom yoki MIME dan) */
export function fileExtension(name: string | undefined, mime: string | undefined): string {
  const fromName = name && /\.([a-z0-9]{1,5})$/i.exec(name)?.[1]?.toLowerCase();
  if (fromName) return fromName;
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
  };
  const base = (mime ?? "").split(";")[0]?.trim() ?? "";
  return map[base] ?? "bin";
}

/** Yandex xarita havolasi (iframe emas) */
export function mapUrl(lat: number, lng: number): string {
  return `https://yandex.uz/maps/?pt=${lng.toFixed(6)},${lat.toFixed(6)}&z=16&l=map`;
}
