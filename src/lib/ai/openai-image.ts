import "server-only";

import { getServerEnv } from "@/lib/env";

/**
 * OpenAI Images (gpt-image): e'lon rasmi (0087) va kasb rasmi (0047/0093) — bitta kalit, bitta model, bitta format
 * (landshaft 3:2, JPEG). Kalit sozlanmagan bo'lsa hech qachon tashqi so'rov yuborilmaydi.
 */
const DEFAULT_MODEL = "gpt-image-1.5";

export type OpenAiImageConfig = { apiKey: string; model: string; quality: "low" | "medium" | "high"; baseUrl: string };

/** OpenAI rasm modeli sozlanganmi (kalit + service role). Sozlanmagan bo'lsa — "Rasm yaratilsinmi?" savoli chiqmaydi */
export function openAiImageConfig(): OpenAiImageConfig | null {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return {
    apiKey: env.OPENAI_API_KEY,
    model: env.LISTING_IMAGE_MODEL || DEFAULT_MODEL,
    quality: env.LISTING_IMAGE_QUALITY ?? "medium",
    baseUrl: (env.OPENAI_BASE_URL || "https://api.openai.com").replace(/\/$/, ""),
  };
}

/** OpenAI Images API (gpt-image): bitta landshaft rasm, JPEG */
export async function openAiImage(cfg: OpenAiImageConfig, prompt: string): Promise<{ bytes: Buffer; mime: string }> {
  const res = await fetch(`${cfg.baseUrl}/v1/images/generations`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.model, prompt, n: 1, size: "1536x1024", quality: cfg.quality, output_format: "jpeg", output_compression: 85 }),
    signal: AbortSignal.timeout(100_000),
  });
  if (!res.ok) {
    // xato matni (kalitsiz) — jurnal uchun qisqa
    const body = await res.text().catch(() => "");
    const code = /"code"\s*:\s*"([^"]{1,60})"/.exec(body)?.[1];
    throw new Error(`provider_http_${res.status}${code ? `_${code}` : ""}`);
  }
  const json = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("provider_no_image");
  return { bytes: Buffer.from(b64, "base64"), mime: "image/jpeg" };
}

/**
 * Provayder tomonidagi xato (balans tugagan, chegara, OpenAI ishlamayapti, javob yo'q): foydalanuvchining aybi emas —
 * urinish sanalmaydi (aks holda e'lon "3 marta urinildi" deb qulflanib qoladi) va tushunarli kod qaytadi.
 */
export function isProviderOutage(msg: string): boolean {
  return /^provider_http_(429|5\d\d|401|403)|^provider_http_400_(billing|insufficient|credit)|^provider_no_image|timeout|aborted|fetch failed/i.test(msg);
}
