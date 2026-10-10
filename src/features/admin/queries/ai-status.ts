import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";
import { GEMINI_DEFAULT_MODEL, GEMINI_FALLBACK_MODELS } from "@/lib/ai/gemini";

export interface AiCallRow {
  at: string;
  feature: string;
  model: string | null;
  ok: boolean;
  latencyMs: number | null;
  error: string | null;
}

export interface AiStatus {
  /** Kalitlar sozlanganmi (qiymati ko'rsatilmaydi) */
  gemini: boolean;
  anthropic: boolean;
  /** Gemini modellari navbati: asosiy → zaxira */
  models: string[];
  day: { requests: number; errors: number };
  /** Oxirgi chaqiruvlar (xatolar birinchi navbatda ko'rinadi) */
  recent: AiCallRow[];
  error: string | null;
}

/** AI holati: kalitlar, modellar, oxirgi 24 soat va oxirgi chaqiruvlar (ai_usage_log — faqat service role o'qiydi) */
export async function getAiStatus(): Promise<AiStatus> {
  const env = getServerEnv();
  const base: AiStatus = {
    gemini: !!env.GEMINI_API_KEY,
    anthropic: !!env.ANTHROPIC_API_KEY,
    models: [...new Set([env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL, ...GEMINI_FALLBACK_MODELS])],
    day: { requests: 0, errors: 0 },
    recent: [],
    error: null,
  };
  try {
    const admin = createAdminClient();
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const [all, failed, recent] = await Promise.all([
      admin.from("ai_usage_log").select("id", { count: "exact", head: true }).gte("created_at", since),
      admin.from("ai_usage_log").select("id", { count: "exact", head: true }).gte("created_at", since).eq("ok", false),
      admin.from("ai_usage_log").select("created_at, feature, model, ok, latency_ms, error").order("created_at", { ascending: false }).limit(12),
    ]);
    base.day = { requests: all.count ?? 0, errors: failed.count ?? 0 };
    base.recent = (recent.data ?? []).map((r) => ({ at: r.created_at, feature: r.feature, model: r.model, ok: r.ok, latencyMs: r.latency_ms, error: r.error }));
    base.error = all.error?.message ?? recent.error?.message ?? null;
  } catch (e) {
    base.error = e instanceof Error ? e.message : "error";
  }
  return base;
}
