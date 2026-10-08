import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * AI so'rovlari jurnali (ai_usage_log): xususiyat, model, natija, kechikish va tokenlar.
 * Admin statistikasida so'rovlar soni, xatolar, kechikish va taxminiy xarajat shu jadvaldan hisoblanadi.
 * Jurnalga yozib bo'lmasa (masalan service kaliti yo'q) — asosiy ish to'xtamaydi.
 */
export interface AiUsage {
  feature: string;
  provider: "gemini" | "anthropic";
  model: string | null;
  ok: boolean;
  latencyMs: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  images?: number;
  error?: string | null;
}

export async function logAiUsage(u: AiUsage): Promise<void> {
  try {
    await createAdminClient()
      .from("ai_usage_log")
      .insert({
        feature: u.feature.slice(0, 40),
        provider: u.provider,
        model: u.model?.slice(0, 80) ?? null,
        ok: u.ok,
        latency_ms: Math.round(u.latencyMs),
        input_tokens: u.inputTokens ?? null,
        output_tokens: u.outputTokens ?? null,
        images: u.images ?? 0,
        error: u.error ? u.error.slice(0, 300) : null,
      });
  } catch {
    // jurnal ixtiyoriy
  }
}
