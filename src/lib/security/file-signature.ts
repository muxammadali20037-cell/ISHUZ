/**
 * Fayl turini birinchi baytlari (magic bytes) bo'yicha aniqlash. Kengaytma yoki Content-Type —
 * mijoz yuborgan da'vo; haqiqiy tur faqat mazmundan bilinadi (masalan, "image/png" deb yuklangan HTML/ZIP).
 */

export type SniffedType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp"
  | "application/pdf"
  | "application/zip"
  | "application/x-cfb"
  | "audio/ogg"
  | "audio/mpeg"
  | "video/webm";

/** Tekshiruv uchun yetarli bosh qism (bayt) */
export const SNIFF_BYTES = 32;

function startsWith(b: Uint8Array, sig: readonly number[], offset = 0): boolean {
  if (b.length < offset + sig.length) return false;
  return sig.every((x, i) => b[offset + i] === x);
}

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

export function sniffMime(b: Uint8Array): SniffedType | null {
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(b, ascii("GIF87a")) || startsWith(b, ascii("GIF89a"))) return "image/gif";
  if (startsWith(b, ascii("RIFF")) && startsWith(b, ascii("WEBP"), 8)) return "image/webp";
  if (startsWith(b, ascii("%PDF-"))) return "application/pdf";
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04])) return "application/zip";
  if (startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "application/x-cfb";
  if (startsWith(b, ascii("OggS"))) return "audio/ogg";
  if (startsWith(b, [0x1a, 0x45, 0xdf, 0xa3])) return "video/webm";
  if (startsWith(b, ascii("ID3")) || (b.length >= 2 && b[0] === 0xff && (b[1]! & 0xe0) === 0xe0)) return "audio/mpeg";
  return null;
}

/** E'lon qilingan tur uchun qabul qilinadigan haqiqiy turlar */
const ACCEPT: Record<string, readonly SniffedType[]> = {
  "image/jpeg": ["image/jpeg"],
  "image/png": ["image/png"],
  "image/gif": ["image/gif"],
  "image/webp": ["image/webp"],
  "application/pdf": ["application/pdf"],
  "application/msword": ["application/x-cfb"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["application/zip"],
  "audio/ogg": ["audio/ogg"],
  "audio/webm": ["video/webm"],
  "audio/mpeg": ["audio/mpeg"],
};

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
};

export function mimeFromPath(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? null;
}

/** Mazmun e'lon qilingan turga mos keladimi. Noma'lum e'lon qilingan tur — mos emas (deny-by-default). */
export function contentMatches(declared: string, b: Uint8Array): boolean {
  const base = declared.split(";")[0]!.trim().toLowerCase();
  const sniffed = sniffMime(b);
  return !!sniffed && (ACCEPT[base]?.includes(sniffed) ?? false);
}
