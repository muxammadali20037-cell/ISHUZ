/**
 * Client tomonda faylni `chat/<conversation_id>/<uuid>.<ext>` ga yuklash.
 * (Server action orqali yuborilmaydi: 15MB gacha fayllar Next action body limitidan katta.)
 * Storage RLS: faqat suhbat a'zolari yozadi/o'qiydi.
 */
import { createClient } from "@/lib/supabase/client";
import { DOCUMENT_MIMES, IMAGE_MIMES, MAX_FILE_BYTES, VOICE_MIMES } from "./schema";
import type { AttachmentMeta, UploadKind } from "./types";
import { fileExtension } from "./utils";

export type UploadError = "too_large" | "bad_type" | "upload_failed";

function baseMime(mime: string): string {
  return mime.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function allowedMimes(kind: UploadKind): readonly string[] {
  return kind === "image" ? IMAGE_MIMES : kind === "document" ? DOCUMENT_MIMES : VOICE_MIMES;
}

export function validateUpload(file: Blob, kind: UploadKind): { ok: true; mime: string } | { ok: false; error: UploadError } {
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: "too_large" };
  const mime = baseMime(file.type);
  if (!allowedMimes(kind).includes(mime)) return { ok: false, error: "bad_type" };
  return { ok: true, mime };
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function uploadChatFile(
  conversationId: string,
  file: File | Blob,
  kind: UploadKind,
  extra: { name?: string; duration?: number } = {},
): Promise<{ ok: true; path: string; meta: AttachmentMeta } | { ok: false; error: UploadError }> {
  const valid = validateUpload(file, kind);
  if (!valid.ok) return valid;
  const name = extra.name ?? (file instanceof File ? file.name : undefined);
  const ext = fileExtension(name, valid.mime);
  const path = `${conversationId}/${randomId()}.${ext}`;
  const supabase = createClient();
  const { error } = await supabase.storage.from("chat").upload(path, file, { contentType: valid.mime, upsert: false, cacheControl: "3600" });
  if (error) {
    console.error("[chat] upload", error.message);
    return { ok: false, error: "upload_failed" };
  }
  const meta: AttachmentMeta = { name: name ?? `${kind}.${ext}`, size: file.size, mime: valid.mime };
  if (extra.duration !== undefined) meta.duration = Math.round(extra.duration * 10) / 10;
  return { ok: true, path, meta };
}
