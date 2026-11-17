import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
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

/** Kanal / bot posti rasmi (1200×800 PNG): vakansiya va ishchi e'loni uchun bir xil ko'rinish */
export async function postImageResponse(data: PostCardData, headers: Record<string, string>): Promise<ImageResponse> {
  const bold = await loadLocalFont("Manrope-Bold.ttf");
  return new ImageResponse(<PostCard data={data} />, {
    ...POST_SIZE,
    fonts: bold ? [800, 700, 600].map((weight) => ({ name: "Manrope", data: bold, weight: weight as 800 | 700 | 600, style: "normal" as const })) : undefined,
    headers,
  });
}
