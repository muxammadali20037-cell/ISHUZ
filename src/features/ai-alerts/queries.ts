import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { billingEnabled } from "@/lib/features";

export interface AiAlertView {
  id: string;
  prompt: string;
  label: string;
  isActive: boolean;
  paidUntil: string | null;
  hits: number;
  lastHitAt: string | null;
  createdAt: string;
}

export interface AiAlertHit {
  id: number;
  title: string;
  who: string;
  verified: boolean;
  region: string;
  salaryFrom: number | null;
  salaryTo: number | null;
  negotiable: boolean;
  link: string;
  createdAt: string;
}

export interface AiAlertsData {
  alerts: AiAlertView[];
  hits: AiAlertHit[];
  telegramConnected: boolean;
  botLink: string | null;
  /** To'lov o'chiq — ishga tushirish davri, bepul */
  free: boolean;
}

export async function getAiAlertsData(userId: string): Promise<AiAlertsData> {
  const supabase = await createClient();
  const [alertsRes, hitsRes, tgRes] = await Promise.all([
    supabase.from("ai_job_alerts").select("id, prompt, label, is_active, paid_until, hits_count, last_hit_at, created_at").eq("profile_id", userId).order("created_at", { ascending: false }),
    supabase.from("notifications").select("id, payload, link, created_at").eq("profile_id", userId).eq("payload->>kind", "ai_alert").order("created_at", { ascending: false }).limit(10),
    supabase.from("telegram_accounts").select("bot_started").eq("profile_id", userId).maybeSingle(),
  ]);
  const bot = getServerEnv().TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  return {
    alerts: (alertsRes.data ?? []).map((a) => ({
      id: a.id,
      prompt: a.prompt,
      label: a.label,
      isActive: a.is_active,
      paidUntil: a.paid_until,
      hits: a.hits_count,
      lastHitAt: a.last_hit_at,
      createdAt: a.created_at,
    })),
    hits: (hitsRes.data ?? []).map((n) => {
      const p = (n.payload ?? {}) as Record<string, unknown>;
      const num = (v: unknown) => (typeof v === "number" ? v : null);
      return {
        id: n.id,
        title: String(p.title ?? ""),
        who: String(p.who ?? ""),
        verified: p.verified === true,
        region: String(p.region ?? ""),
        salaryFrom: num(p.salary_from),
        salaryTo: num(p.salary_to),
        negotiable: p.negotiable === true,
        link: n.link && n.link.startsWith("/") ? n.link : "/jobs",
        createdAt: n.created_at,
      };
    }),
    telegramConnected: tgRes.data?.bot_started === true,
    botLink: bot ? `https://t.me/${bot}?start=alerts` : null,
    free: !billingEnabled(),
  };
}
