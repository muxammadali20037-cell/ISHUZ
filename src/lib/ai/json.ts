import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { AI_MODEL, getAiClient } from "./client";
import { AiBusyError, geminiJson, type AiCallOptions } from "./gemini";
import { logAiUsage } from "./usage";

/** AI sozlanmagan (kalit yo'q) */
export class AiUnavailableError extends Error {}
/** Javob sxemaga mos emas yoki model rad etdi — natija ishlatilmaydi */
export class AiInvalidOutputError extends Error {}

export function aiProviderConfigured(): boolean {
  const env = getServerEnv();
  return !!(env.GEMINI_API_KEY || env.ANTHROPIC_API_KEY);
}

export function isAiBusy(error: unknown): boolean {
  return error instanceof Anthropic.RateLimitError || error instanceof AiBusyError;
}

/**
 * Qat'iy sxemali AI chaqiruvi (Gemini bo'lsa u, aks holda Claude). Natija zod bilan tekshiriladi;
 * mos kelmasa AiInvalidOutputError — chaqiruvchi natijani "ruxsat" deb QABUL QILMAYDI.
 * Rasm (vision) qo'llab-quvvatlanadi. Har chaqiruv ai_usage_log ga yoziladi.
 */
export async function aiJson<T extends z.ZodType>(schema: T, system: string, user: string, opts: AiCallOptions = {}): Promise<z.infer<T>> {
  const env = getServerEnv();
  if (env.GEMINI_API_KEY) {
    const out = await geminiJson(schema, system, user, opts);
    if (out == null) throw new AiInvalidOutputError("invalid_output");
    return out;
  }
  const client = getAiClient();
  if (!client) throw new AiUnavailableError("ai_disabled");
  const started = Date.now();
  const images = opts.images ?? [];
  const feature = opts.feature ?? "other";
  try {
    const response = await client.beta.messages.parse(
      {
        model: AI_MODEL,
        max_tokens: opts.maxOutputTokens ?? 4000,
        output_config: { effort: "low", format: betaZodOutputFormat(schema) },
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [
          {
            role: "user",
            content: [
              ...images.map((im) => ({
                type: "image" as const,
                source: { type: "base64" as const, media_type: im.mimeType as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data: im.data },
              })),
              { type: "text" as const, text: user },
            ],
          },
        ],
      },
      { timeout: opts.timeoutMs ?? 90_000 },
    );
    const parsed = response.stop_reason === "refusal" ? null : ((response.parsed_output as z.infer<T> | null) ?? null);
    await logAiUsage({
      feature, provider: "anthropic", model: AI_MODEL, ok: parsed != null, latencyMs: Date.now() - started,
      inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, images: images.length,
      error: parsed == null ? (response.stop_reason === "refusal" ? "refusal" : "invalid_output") : null,
    });
    if (parsed == null) throw new AiInvalidOutputError(response.stop_reason === "refusal" ? "refusal" : "invalid_output");
    return parsed;
  } catch (e) {
    if (!(e instanceof AiInvalidOutputError)) {
      await logAiUsage({ feature, provider: "anthropic", model: AI_MODEL, ok: false, latencyMs: Date.now() - started, images: images.length, error: e instanceof Error ? e.message : "error" });
    }
    throw e;
  }
}
