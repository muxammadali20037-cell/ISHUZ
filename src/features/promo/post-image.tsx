import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { publicEnv } from "@/lib/env";
import { POST_SIZE, PostCard, type PostCardData } from "./post-card";

/** Loyihadagi Manrope (TTF, kirill + lotin) — tarmoqsiz; kanal posti rasmi har doim bir xil chiqsin */
async function loadLocalFont(file: "Manrope-Bold.ttf"): Promise<ArrayBuffer | null> {
  try {
    const buf = await readFile(path.join(process.cwd(), "src/features/cv/fonts", file));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  } catch {
    return null;
  }
}

/**
 * E'lon rasmi (AI) — o'zimiz yuklab, data URL qilib beramiz: faqat o'z Supabase saqlovimizdan (begona manzilga so'rov
 * yo'q), 8 s, 5 MB gacha, faqat rasm. Yuklab bo'lmasa — rasmsiz shablon (post rasmi baribir chiqsin).
 */
export async function inlinePhoto(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  const base = publicEnv.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  if (!url.startsWith(`${base}/storage/v1/object/public/`)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/^image\/(jpeg|png|webp)/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 5 * 1024 * 1024) return null;
    return `data:${type.split(";")[0]};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Kanal / bot posti rasmi (1200×800 PNG): vakansiya va ishchi e'loni uchun bir xil ko'rinish */
export async function postImageResponse(data: PostCardData, headers: Record<string, string>): Promise<ImageResponse> {
  const [bold, photo] = await Promise.all([loadLocalFont("Manrope-Bold.ttf"), inlinePhoto(data.photo)]);
  return new ImageResponse(<PostCard data={{ ...data, photo }} />, {
    ...POST_SIZE,
    fonts: bold ? [800, 700, 600].map((weight) => ({ name: "Manrope", data: bold, weight: weight as 800 | 700 | 600, style: "normal" as const })) : undefined,
    headers,
  });
}
