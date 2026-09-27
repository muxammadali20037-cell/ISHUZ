import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { getServerEnv } from "@/lib/env";

/** AI yordamchi modeli (tahlil + matn yozish) */
export const AI_MODEL = "claude-opus-5";

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
