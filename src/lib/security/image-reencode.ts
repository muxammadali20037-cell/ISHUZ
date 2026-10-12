import "server-only";

import sharp from "sharp";
import { contentMatches, SNIFF_BYTES } from "./file-signature";

/** Yuklangan rasm uchun umumiy chegaralar: hajm (karantin bucket'lari bilan bir xil) va piksel ("piksel bombasi") */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;

/**
 * Rasm baytlarini tekshirish va metama'lumotsiz qayta kodlash (sof funksiya — testlanadi):
 * e'lon qilingan tur bilan mazmun (magic bytes) mos kelishi, piksel chegarasi; EXIF yo'nalishi qo'llanadi,
 * chiqishda EXIF/joylashuv/ICC yozilmaydi (sharp sukut bo'yicha tashlaydi). Mos kelmasa — null.
 */
export async function reencodeImage(input: Buffer, declaredMime: string, opts: { maxSide: number; quality: number }): Promise<Buffer | null> {
  if (input.length === 0 || input.length > IMAGE_MAX_BYTES) return null;
  if (!contentMatches(declaredMime, input.subarray(0, SNIFF_BYTES))) return null;
  try {
    return await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "error" })
      .rotate()
      .resize({ width: opts.maxSide, height: opts.maxSide, fit: "inside", withoutEnlargement: true })
      .webp({ quality: opts.quality })
      .toBuffer();
  } catch {
    return null;
  }
}
