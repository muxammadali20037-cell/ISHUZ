import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";
import { MATCH_WEIGHT_KEYS } from "../schema";

// =====================================================================
// Moderatsiya navbati
// =====================================================================
export const MODERATION_TABS = ["review", "appeals", "pending", "rejected", "errors"] as const;
export type ModerationTab = (typeof MODERATION_TABS)[number];
export const QUEUE_PAGE = 30;

export interface QueueRow {
  entity: "vacancy" | "worker";
  id: string;
  title: string;
  preview: string | null;
  photo_path: string | null;
  owner_id: string;
  owner_first_name: string | null;
  owner_last_name: string | null;
  owner_blocked: boolean | null;
  status: string;
  state: string;
  category: string | null;
  message: string | null;
  fields: string[];
  attempts: number;
  version: number;
  moderated_version: number | null;
  appeal_at: string | null;
  requested_at: string;
  last_check: { decision: string; source: string; reason_code: string | null; signals: string[]; error: string | null; created_at: string } | null;
}

export async function getModerationQueue(tab: ModerationTab, entity: "vacancy" | "worker" | null, page: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_moderation_queue", { p_tab: tab, p_entity: entity ?? undefined, p_limit: QUEUE_PAGE, p_offset: (page - 1) * QUEUE_PAGE });
  const d = (data ?? {}) as { total?: number; rows?: QueueRow[]; counts?: Record<string, number> };
  return { rows: d.rows ?? [], total: d.total ?? 0, counts: d.counts ?? {}, error: error?.message ?? null };
}

export interface CheckRow {
  id: number;
  version: number;
  source: string;
  decision: string;
  category: string | null;
  reason_code: string | null;
  user_message: string | null;
  flagged_fields: string[];
  signals: string[];
  model: string | null;
  latency_ms: number | null;
  error: string | null;
  created_at: string;
}

/** Tekshiruv tarixi (RLS: vacancies.moderate) */
export async function getModerationHistory(entity: "vacancy" | "worker", id: string): Promise<CheckRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("moderation_checks")
    .select("id, version, source, decision, category, reason_code, user_message, flagged_fields, signals, model, latency_ms, error, created_at")
    .eq("entity_type", entity)
    .eq("entity_id", id)
    .order("created_at", { ascending: false })
    .limit(30);
  return (data ?? []) as CheckRow[];
}

// =====================================================================
// Moslik sozlamalari
// =====================================================================
export interface MatchingSettings {
  weights: Record<(typeof MATCH_WEIGHT_KEYS)[number], number>;
  threshold: number;
  version: number;
  dailyLimit: number;
}

export async function getMatchingSettings(): Promise<MatchingSettings> {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("key, value").in("key", ["match_weights", "match_notify_threshold", "match_rules_version", "match_notify_daily_limit"]);
  const get = (k: string): Json | undefined => data?.find((r) => r.key === k)?.value;
  const w = (get("match_weights") ?? {}) as Record<string, number>;
  const DEFAULTS = { profession: 25, location: 15, salary: 15, experience: 10, skills: 15, schedule: 10, employment: 5, language: 5 };
  return {
    weights: Object.fromEntries(MATCH_WEIGHT_KEYS.map((k) => [k, typeof w[k] === "number" ? w[k] : DEFAULTS[k]])) as MatchingSettings["weights"],
    threshold: Number(get("match_notify_threshold") ?? 90),
    version: Number(get("match_rules_version") ?? 2),
    dailyLimit: Number(get("match_notify_daily_limit") ?? 10),
  };
}

// =====================================================================
// Navbatlar monitoringi
// =====================================================================
export interface QueueStatus {
  moderation: { pending: number; retrying: number; oldest: string | null; review: number; errors_24h: number; last_errors: { entity_type: string; created_at: string; error: string | null }[] };
  match_jobs: { queued: number; running: number; failed: number; done_24h: number; last_errors: { id: number; entity_type: string; created_at: string; last_error: string | null }[] };
  telegram: { queued: number; due: number; retrying: number; failed_24h: number; sent_24h: number; last_errors: { id: number; type: string; created_at: string; tg_status: string; tg_error: string | null }[] };
  ai_24h: { requests: number; errors: number };
}

export async function getQueueStatus(): Promise<{ status: QueueStatus | null; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_queue_status");
  return { status: (data as unknown as QueueStatus) ?? null, error: error?.message ?? null };
}

// =====================================================================
// Statistika (davr: Toshkent vaqti)
// =====================================================================
export interface StatsV2 {
  users_total: number;
  users_new: number;
  workers_active: number;
  employers_active: number;
  vacancies_active: number;
  employers_pending: number;
  employers_verified: number;
  moderation_pending: number;
  moderation_review: number;
  published: number;
  rejected: number;
  rejected_by_category: Record<string, number>;
  closed_found_job: number;
  closed_found_worker: number;
  matches_90: number;
  matches_90_cache: number;
  subscriptions: { worker: number; employer: number; waiting_bot: number };
  telegram: { sent: number; failed: number; queued: number; opened: number };
  ai_listings: { started: number; prepared: number; published: number };
  ai_usage: { requests: number; errors: number; avg_latency_ms: number; p95_latency_ms: number; input_tokens: number; output_tokens: number; images: number; cost_usd: number; by_feature: Record<string, number> };
  top_professions: { id: string; name_uz: string; name_ru: string; searches: number; zero: number }[];
  zero_queries: { query: string; n: number }[];
  searches: number;
  searches_zero: number;
  regions: { id: string; name_uz: string; name_ru: string; demand: number; vacancies: number; workers: number }[];
  funnel: Record<string, number>;
}

export async function getStatsV2(from: Date, to: Date): Promise<{ stats: StatsV2 | null; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_stats_v2", { p_from: from.toISOString(), p_to: to.toISOString() });
  return { stats: (data as unknown as StatsV2) ?? null, error: error?.message ?? null };
}

export type SeriesRow = { day: string; users_new: number; published: number; rejected: number; searches: number; searches_zero: number; contact_clicks: number; tg_sent: number; tg_failed: number; ai_requests: number; outcomes: number };
export const SERIES_METRICS = ["users_new", "published", "rejected", "searches", "searches_zero", "contact_clicks", "tg_sent", "tg_failed", "ai_requests", "outcomes"] as const;

export async function getStatsSeries(from: Date, to: Date): Promise<{ rows: SeriesRow[]; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_stats_series", { p_from: from.toISOString(), p_to: to.toISOString() });
  const rows = (data ?? []).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, k === "day" ? String(v) : Number(v)])) as SeriesRow);
  return { rows, error: error?.message ?? null };
}
