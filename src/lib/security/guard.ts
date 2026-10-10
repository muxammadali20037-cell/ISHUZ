import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { isCrossSiteRequest, isJsonRequest } from "./request";

/** Ilova va admin host manzillari (Origin taqqoslash uchun) */
export function allowedOrigins(): string[] {
  const env = getServerEnv();
  const out = new Set<string>();
  for (const u of [env.APP_URL, process.env.NEXT_PUBLIC_APP_URL]) {
    try {
      if (u) out.add(new URL(u).origin);
    } catch {
      // noto'g'ri URL — e'tiborsiz
    }
  }
  if (env.ADMIN_HOST) out.add(`https://${env.ADMIN_HOST.trim().toLowerCase()}`);
  return [...out];
}

/**
 * Holatni o'zgartiruvchi brauzer so'rovlari (kirish, bog'lash) uchun: faqat JSON va faqat o'z saytimizdan.
 * Boshqa saytdagi oddiy HTML forma JSON yubora olmaydi va Origin'i boshqa — login CSRF va CSRF yopiladi.
 * Muvofiq bo'lsa null, aks holda tayyor javob.
 */
export function rejectUnsafeRequest(req: NextRequest): NextResponse | null {
  if (!isJsonRequest(req.headers)) return NextResponse.json({ error: "unsupported_media_type" }, { status: 415 });
  if (isCrossSiteRequest(req.headers, req.nextUrl.origin, allowedOrigins())) return NextResponse.json({ error: "cross_site" }, { status: 403 });
  return null;
}

/** Kichik JSON tana (bayt chegarasi) — katta tana xotira/CPU'ni band qilmasin */
export async function readJsonBody(req: NextRequest, maxBytes = 16 * 1024): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > maxBytes) return null;
  try {
    const text = await req.text();
    if (text.length > maxBytes) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}
