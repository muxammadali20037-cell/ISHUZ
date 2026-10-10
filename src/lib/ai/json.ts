import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { AI_MODEL, getAiClient } from "./client";
import { AiBusyError, geminiJson, type AiCallOptions } from "./gemini";
import { logAiUsage } from "./usage";
import { hitRate } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security/events";

/** AI sozlanmagan (kalit yo'q) */
export class AiUnavailableError extends Error {}
/** Javob sxemaga mos emas yoki model rad etdi — natija ishlatilmaydi */
export class AiInvalidOutputError extends Error {}

export function aiProviderConfigured(): boolean {
  const env = getServerEnv();
  return !!(env.GEMINI_API_KEY || env.ANTHROPIC_API_KEY);
}

/**
 * Kunlik umumiy AI byudjeti (xarajat hujumi / bot spam): foydalanuvchi boshlaydigan funksiyalar uchun.
 * Moderatsiya va rasm generatsiyasi — o'z kunlik limitlari bilan. Fail-closed: hisoblagich ishlamasa AI chaqirilmaydi.
 */
const AI_DAILY_BUDGET: Record<string, number> = {
  draft_vacancy: 3000,
  draft_worker: 3000,
  search_parse: 8000,
  verification_review: 500,
  other: 2000,
};
const AI_DAILY_BUDGET_TOTAL = 12000;
const BUDGET_EXEMPT = new Set(["moderation_text", "moderation_image", "moderation_generated_image", "profession_image", "ai_probe"]);

async function withinDailyBudget(feature: string): Promise<boolean> {
  if (BUDGET_EXEMPT.has(feature)) return true;
  const limit = AI_DAILY_BUDGET[feature] ?? AI_DAILY_BUDGET.other!;
  const [one, all] = await Promise.all([hitRate(`ai:day:${feature}`, limit, 86400), hitRate("ai:day:user_total", AI_DAILY_BUDGET_TOTAL, 86400)]);
  for (const [r, lim] of [[one, limit], [all, AI_DAILY_BUDGET_TOTAL]] as const) {
    if (!r.ok && r.reason === "limited" && r.count === lim + 1) {
      await logSecurityEvent({ type: "cost.ai_budget_exhausted", severity: "high", reason: feature, action: "throttled", details: { limit: lim } });
    }
  }
  return one.ok && all.ok;
}

export function isAiBusy(error: unknown): boolean {
  return error instanceof Anthropic.RateLimitError || error instanceof AiBusyError;
}

/**
 * Qat'iy sxemali AI chaqiruvi (Gemini bo'lsa u; u ishlamasa yoki kaliti yo'q bo'lsa — Claude). Natija zod bilan tekshiriladi;
 * mos kelmasa AiInvalidOutputError — chaqiruvchi natijani "ruxsat" deb QABUL QILMAYDI.
 * Rasm (vision) qo'llab-quvvatlanadi. Har chaqiruv ai_usage_log ga yoziladi.
 */
export async function aiJson<T extends z.ZodType>(schema: T, system: string, user: string, opts: AiCallOptions = {}): Promise<z.infer<T>> {
  const env = getServerEnv();
  if (!(await withinDailyBudget(opts.feature ?? "other"))) throw new AiUnavailableError("ai_budget_exhausted");
  if (env.GEMINI_API_KEY) {
    try {
      const out = await geminiJson(schema, system, user, opts);
      if (out == null) throw new AiInvalidOutputError("invalid_output");
      return out;
    } catch (e) {
      // Gemini band yoki ishlamadi — Claude kaliti bo'lsa, unga o'tiladi (noto'g'ri javob esa qabul qilinmaydi)
      if (e instanceof AiInvalidOutputError || !getAiClient()) throw e;
    }
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
