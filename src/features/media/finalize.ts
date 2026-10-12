import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { mimeFromPath } from "@/lib/security/file-signature";
import { IMAGE_MAX_BYTES, reencodeImage } from "@/lib/security/image-reencode";
import { logSecurityEvent } from "@/lib/security/events";
import { isLegacyMediaPath, isRawMediaPath, isVerifiedMediaPath, MEDIA_BUCKET, MEDIA_QUARANTINE, type MediaKind } from "./paths";

/**
 * Profil rasmi va logotip ommaga chiqishdan oldin serverda tekshiriladi va qayta kodlanadi (F-06, 0059):
 * xom fayl (karantindan yoki eski nomdan) service role bilan o'qiladi → hajm, mazmun (magic bytes), piksel chegarasi →
 * EXIF/joylashuvsiz WebP → <egasi>/v-<sha256>.webp. Xom fayl natijadan qat'i nazar o'chiriladi.
 * Huquq (o'z profili / kompaniya admini) chaqiruvchi tomonidan oldindan tekshiriladi.
 */
const SPEC: Record<MediaKind, { maxSide: number; quality: number }> = {
  avatar: { maxSide: 640, quality: 82 },
  logo: { maxSide: 512, quality: 90 },
};

export type MediaError = "media_invalid" | "media_unavailable";
export type MediaResult = { ok: true; path: string } | { ok: false; error: MediaError };

export function mediaFinalizeAvailable(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export async function finalizeMedia(kind: MediaKind, owner: string, path: string, actorId: string): Promise<MediaResult> {
  if (isVerifiedMediaPath(owner, path)) return { ok: true, path };
  const raw = isRawMediaPath(kind, owner, path);
  if (!raw && !isLegacyMediaPath(kind, owner, path)) return { ok: false, error: "media_invalid" };
  const declared = mimeFromPath(path);
  if (!declared) return { ok: false, error: "media_invalid" };
  if (!mediaFinalizeAvailable()) return { ok: false, error: "media_unavailable" };
  const admin = createAdminClient();
  const source = raw ? MEDIA_QUARANTINE : MEDIA_BUCKET[kind];
  const drop = () => admin.storage.from(source).remove([path]).catch(() => undefined);

  const { data: blob } = await admin.storage.from(source).download(path);
  if (!blob) return { ok: false, error: "media_unavailable" };
  const out = blob.size > IMAGE_MAX_BYTES ? null : await reencodeImage(Buffer.from(await blob.arrayBuffer()), declared, SPEC[kind]);
  if (!out) {
    await logSecurityEvent({ type: "upload.content_rejected", severity: "medium", reason: `${kind}_upload`, actorId, action: "blocked" });
    await drop();
    return { ok: false, error: "media_invalid" };
  }
  const finalPath = `${owner}/v-${createHash("sha256").update(out).digest("hex")}.webp`;
  // nom = mazmun xeshi: qayta urinishda o'sha baytlar yoziladi (upsert faqat shu sababli)
  const { error } = await admin.storage.from(MEDIA_BUCKET[kind]).upload(finalPath, out, { contentType: "image/webp", cacheControl: "31536000", upsert: true });
  if (error) return { ok: false, error: "media_unavailable" };
  await drop();
  return { ok: true, path: finalPath };
}

/** Egasi papkasidagi boshqa fayllar (eski rasm, eski nomdagi xom fayl) — faqat `keep` qoladi; null — hammasi o'chadi */
export async function pruneMedia(kind: MediaKind, owner: string, keep: string | null): Promise<void> {
  if (!mediaFinalizeAvailable()) return;
  const admin = createAdminClient();
  const bucket = admin.storage.from(MEDIA_BUCKET[kind]);
  const { data } = await bucket.list(owner, { limit: 100 });
  const stale = (data ?? []).map((f) => `${owner}/${f.name}`).filter((p) => p !== keep);
  if (stale.length) await bucket.remove(stale).catch(() => undefined);
}

/** Karantinda qolib ketgan xom fayllar (ro'yxat bazada: stale_raw_media, 0059). 0059 bo'lmasa — hech narsa qilmaydi */
export async function cleanupRawMedia(limit = 100): Promise<number> {
  if (!mediaFinalizeAvailable()) return 0;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("stale_raw_media", { p_limit: limit });
  if (error || !data?.length) return 0;
  const { data: gone, error: rmErr } = await admin.storage.from(MEDIA_QUARANTINE).remove(data.map((r) => r.name));
  return rmErr ? 0 : (gone?.length ?? 0);
}
