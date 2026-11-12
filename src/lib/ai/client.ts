import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { getServerEnv } from "@/lib/env";

/**
 * Claude modeli (tahlil, e'lon matni, moderatsiya). Standart — Claude Sonnet 5.5: tez va Opus'dan ~2 baravar arzon
 * ($2 / $10 har million token). Boshqasini Vercel'da ANTHROPIC_MODEL bilan tanlash mumkin (masalan arzonroq
 * "claude-haiku-5-5" yoki kuchliroq "claude-opus-5-5") — kod o'zgarmaydi.
 */
export const AI_DEFAULT_MODEL = "claude-sonnet-5-5";
export const AI_MODEL = process.env.ANTHROPIC_MODEL?.trim() || AI_DEFAULT_MODEL;

let cached: Anthropic | null = null;

/** Kalit sozlanmagan bo'lsa null — AI funksiyalari o'chiq */
export function getAiClient(): Anthropic | null {
  const { ANTHROPIC_API_KEY } = getServerEnv();
  if (!ANTHROPIC_API_KEY) return null;
  cached ??= new Anthropic({ apiKey: ANTHROPIC_API_KEY, timeout: 90_000, maxRetries: 1 });
  return cached;
}

/** AI yoqilgan: Gemini (bepul) yoki Claude kaliti bor */
export function aiEnabled(): boolean {
  const env = getServerEnv();
  return !!(env.GEMINI_API_KEY || env.ANTHROPIC_API_KEY);
}

export interface ClaudeProbeResult {
  model: string;
  ok: boolean;
  latencyMs: number;
  /** qisqa xato matni (401 — kalit noto'g'ri, 404 — model yo'q, 429 — limit, 529 — band) */
  error: string | null;
}

/** Admin "AI'ni sinash": Claude'ga kichik so'rov — kalit, model va tezlik. Kalit yo'q bo'lsa — bo'sh ro'yxat. */
export async function claudeProbe(): Promise<ClaudeProbeResult[]> {
  const client = getAiClient();
  if (!client) return [];
  const started = Date.now();
  let error: string | null = null;
  try {
    await client.messages.create(
      { model: AI_MODEL, max_tokens: 16, messages: [{ role: "user", content: "Reply with: ok" }] },
      { timeout: 20_000, maxRetries: 0 },
    );
  } catch (e) {
    error = e instanceof Anthropic.APIError ? `http_${e.status ?? "?"}: ${e.message.slice(0, 200)}` : e instanceof Error ? e.message : "network";
  }
  return [{ model: AI_MODEL, ok: !error, latencyMs: Date.now() - started, error }];
}
