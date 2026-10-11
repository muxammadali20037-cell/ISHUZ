import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { contentMatches, mimeFromPath, SNIFF_BYTES } from "@/lib/security/file-signature";
import { logSecurityEvent } from "@/lib/security/events";

/**
 * Ish joyi surati — ommaga chiqishdan oldin serverda tekshiriladi va qayta kodlanadi (F-06):
 *  1) brauzer xom faylni yopiq karantinga (vacancy-uploads, 0058) yoki — eski bazada — ommaviy bucket'ga yuklaydi;
 *  2) server uni service role bilan o'qiydi: hajm, mazmun (magic bytes) va piksel chegarasi tekshiriladi;
 *  3) EXIF/joylashuv va boshqa metama'lumotlarsiz WebP qilib qayta kodlanadi (o'lcham ≤ 1600 px);
 *  4) mazmun xeshi nomi bilan ommaviy bucket'ga yoziladi: <egasi>/v-<sha256>.webp. 0058 dan keyin mijoz "v-" fayllarni
 *     yoza/almashtira/o'chira olmaydi, vakansiyaga esa faqat shunday yo'l yoziladi — tekshirilgan fayl o'zgarmaydi.
 * Karantindagi xom fayl tekshiruvdan keyin (natijasidan qat'i nazar) darhol o'chiriladi; qolganlarini cleanupRawVacancyPhotos tozalaydi.
 */

const PUBLIC_BUCKET = "vacancy-photos";
const QUARANTINE_BUCKET = "vacancy-uploads";
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const MAX_SIDE = 1600;

export type PhotoError = "photo_invalid" | "photo_unavailable";
export type FinalizeResult = { ok: true; path: string } | { ok: false; error: PhotoError };

export function isVerifiedPhotoPath(userId: string, path: string): boolean {
  return path.startsWith(`${userId}/`) && /^[0-9a-f-]{36}\/v-[0-9a-f]{64}\.webp$/.test(path);
}

function isRawPhotoPath(userId: string, path: string): boolean {
  return path.startsWith(`${userId}/`) && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(path);
}

/** Rasm baytlarini tekshirish va metama'lumotsiz qayta kodlash (sof funksiya — testlanadi) */
export async function reencodePhoto(input: Buffer, declaredMime: string): Promise<Buffer | null> {
  if (input.length === 0 || input.length > MAX_BYTES) return null;
  if (!contentMatches(declaredMime, input.subarray(0, SNIFF_BYTES))) return null;
  try {
    return await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "error" })
      .rotate() // EXIF yo'nalishi qo'llanadi; chiqishda metama'lumot yozilmaydi (sharp sukut bo'yicha tashlaydi)
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return null;
  }
}

/**
 * Xom yo'l → tekshirilgan yo'l. Allaqachon tekshirilgan (o'z papkasidagi "v-") yo'l o'zgarmaydi.
 * Eski e'londagi (0058 dan oldingi) xom rasm ham shu yerda bir marta tekshirilgan nusxaga o'tadi.
 */
export async function finalizeVacancyPhoto(userId: string, path: string): Promise<FinalizeResult> {
  if (isVerifiedPhotoPath(userId, path)) return { ok: true, path };
  if (!isRawPhotoPath(userId, path)) return { ok: false, error: "photo_invalid" };
  const declared = mimeFromPath(path);
  if (!declared) return { ok: false, error: "photo_invalid" };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, error: "photo_unavailable" };
  const admin = createAdminClient();

  let source = QUARANTINE_BUCKET;
  let { data: blob } = await admin.storage.from(QUARANTINE_BUCKET).download(path);
  if (!blob) {
    source = PUBLIC_BUCKET;
    ({ data: blob } = await admin.storage.from(PUBLIC_BUCKET).download(path));
  }
  if (!blob) return { ok: false, error: "photo_unavailable" };
  if (blob.size > MAX_BYTES) return { ok: false, error: "photo_invalid" };

  const out = await reencodePhoto(Buffer.from(await blob.arrayBuffer()), declared);
  if (!out) {
    await logSecurityEvent({ type: "upload.content_rejected", severity: "medium", reason: "vacancy_photo", actorId: userId, action: "blocked" });
    // rad etilgan xom fayl karantinda qolmaydi
    if (source === QUARANTINE_BUCKET) await admin.storage.from(QUARANTINE_BUCKET).remove([path]).catch(() => undefined);
    return { ok: false, error: "photo_invalid" };
  }
  const finalPath = `${userId}/v-${createHash("sha256").update(out).digest("hex")}.webp`;
  // nom = mazmun xeshi: qayta urinishda o'sha baytlar yoziladi (upsert faqat shu sababli)
  const { error: upErr } = await admin.storage.from(PUBLIC_BUCKET).upload(finalPath, out, { contentType: "image/webp", cacheControl: "31536000", upsert: true });
  if (upErr) return { ok: false, error: "photo_unavailable" };
  // karantindagi xom nusxa endi kerak emas; ommaviy bucket'dagi eski xom fayl e'lon yangilangach tozalashda o'chadi
  if (source === QUARANTINE_BUCKET) await admin.storage.from(QUARANTINE_BUCKET).remove([path]).catch(() => undefined);
  return { ok: true, path: finalPath };
}

/**
 * Tashlab ketilgan fayllar (ro'yxat bazada: stale_raw_vacancy_photos, 0058) Storage API orqali o'chiriladi.
 * Hech qaysi vakansiya ishlatayotgan fayl ro'yxatga tushmaydi. 0058 bo'lmasa — hech narsa qilmaydi.
 */
export async function cleanupRawVacancyPhotos(limit = 100): Promise<number> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return 0;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("stale_raw_vacancy_photos", { p_limit: limit });
  if (error || !data?.length) return 0;
  let removed = 0;
  for (const bucket of [QUARANTINE_BUCKET, PUBLIC_BUCKET]) {
    const names = data.filter((r) => r.bucket_id === bucket).map((r) => r.name);
    if (!names.length) continue;
    const { data: gone, error: rmErr } = await admin.storage.from(bucket).remove(names);
    if (!rmErr) removed += gone?.length ?? 0;
  }
  return removed;
}
