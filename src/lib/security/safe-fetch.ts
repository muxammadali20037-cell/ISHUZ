/**
 * Tashqi rasmni xavfsiz yuklab olish (SSRF himoyasi): faqat ishonchli manzillar; yo'naltirishlar qo'lda kuzatiladi
 * va har birida manzil qayta tekshiriladi (ichki tarmoqqa burilmaydi); hajm oqim bilan cheklanadi;
 * tur sarlavha bo'yicha VA mazmun (magic bytes) bo'yicha tekshiriladi.
 */
import { contentMatches, SNIFF_BYTES } from "./file-signature";

export class FetchRejectedError extends Error {}
/** Mazmun e'lon qilingan turga mos emas (niqoblangan fayl) — qayta urinish foyda bermaydi */
export class ContentMismatchError extends FetchRejectedError {}

export interface SafeImageOptions {
  isTrusted: (url: string) => boolean;
  maxBytes: number;
  types: ReadonlySet<string>;
  maxHops?: number;
  timeoutMs?: number;
}

/** Tanani oqim bilan o'qiydi: chegaradan oshsa darhol to'xtaydi (katta faylni xotiraga to'liq olmaydi) */
export async function readCapped(res: Response, maxBytes: number): Promise<Buffer> {
  const reader = res.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new FetchRejectedError("image_too_large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function fetchTrustedImage(url: string, opts: SafeImageOptions): Promise<{ mimeType: string; bytes: Buffer }> {
  let current = url;
  for (let hop = 0; hop < (opts.maxHops ?? 4); hop++) {
    if (!opts.isTrusted(current)) throw new FetchRejectedError("image_untrusted");
    const res = await fetch(current, { signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000), redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new FetchRejectedError(`image_${res.status}`);
      current = new URL(location, current).toString();
      continue;
    }
    if (!res.ok) throw new FetchRejectedError(`image_${res.status}`);
    const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (!opts.types.has(type)) throw new FetchRejectedError("image_type");
    if (Number(res.headers.get("content-length") ?? "0") > opts.maxBytes) throw new FetchRejectedError("image_too_large");
    const bytes = await readCapped(res, opts.maxBytes);
    if (!contentMatches(type, bytes.subarray(0, SNIFF_BYTES))) throw new ContentMismatchError("image_content_mismatch");
    return { mimeType: type, bytes };
  }
  throw new FetchRejectedError("image_redirects");
}
