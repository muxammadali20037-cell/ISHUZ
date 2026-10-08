import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { enabledProviders, type PaymentProvider } from "@/features/billing/providers";
import { isAndroidApp } from "@/lib/app-platform.server";
import { getLocale } from "@/lib/i18n/server";
import type { Enums } from "@/types/database.types";

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

/** Ish beruvchiga topilgan nomzod (telefonsiz: ism + familiya bosh harfi) */
export interface AiWorkerHit {
  id: number;
  name: string;
  profession: string;
  region: string;
  experience: Enums<"experience_level"> | null;
  salary: number | null;
  link: string;
  createdAt: string;
}

export interface AiAlertsData {
  alerts: AiAlertView[];
  hits: AiAlertHit[];
  /** Ish beruvchi kuzatuvlari ("Menga ishchi topsin") */
  workerAlerts: AiAlertView[];
  workerHits: AiWorkerHit[];
  telegramConnected: boolean;
  /** Bot sozlangan — xavfsiz bog'lash havolasi so'rab olinadi */
  botConfigured: boolean;
  /** AI qidiruv bepul rejimda (app_settings.ai_alerts_paid=false) */
  free: boolean;
  /** Obuna tugash vaqti (faol bo'lsa) */
  paidUntil: string | null;
  price: number;
  providers: PaymentProvider[];
  /** Google Play ilovasi ichida — narx va to'lov tugmalari ko'rsatilmaydi */
  inApp: boolean;
}

export async function getAiAlertsData(userId: string): Promise<AiAlertsData> {
  const supabase = await createClient();
  const [alertsRes, hitsRes, tgRes, subRes, paidRes, priceRes, inApp, wAlertsRes, wHitsRes, locale] = await Promise.all([
    supabase.from("ai_job_alerts").select("id, prompt, label, is_active, paid_until, hits_count, last_hit_at, created_at").eq("profile_id", userId).order("created_at", { ascending: false }),
    supabase.from("notifications").select("id, payload, link, created_at").eq("profile_id", userId).eq("payload->>kind", "ai_alert").order("created_at", { ascending: false }).limit(10),
    supabase.from("telegram_accounts").select("bot_started").eq("profile_id", userId).maybeSingle(),
    supabase.from("ai_alert_subscriptions").select("paid_until").eq("profile_id", userId).maybeSingle(),
    supabase.rpc("ai_alerts_paid"),
    supabase.from("app_settings").select("value").eq("key", "price_ai_alerts").maybeSingle(),
    isAndroidApp(),
    supabase.from("ai_worker_alerts").select("id, prompt, label, is_active, hits_count, last_hit_at, created_at").eq("profile_id", userId).order("created_at", { ascending: false }),
    supabase.from("notifications").select("id, payload, link, created_at").eq("profile_id", userId).eq("payload->>kind", "ai_worker_alert").order("created_at", { ascending: false }).limit(10),
    getLocale(),
  ]);
  const paidUntil = subRes.data?.paid_until && new Date(subRes.data.paid_until) > new Date() ? subRes.data.paid_until : null;
  const bot = getServerEnv().TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  const EXP = new Set<string>(["none", "lt_6m", "6_12m", "1_2y", "2_3y", "3_5y", "5y_plus"]);
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
    workerAlerts: (wAlertsRes.data ?? []).map((a) => ({
      id: a.id,
      prompt: a.prompt,
      label: a.label,
      isActive: a.is_active,
      paidUntil: null,
      hits: a.hits_count,
      lastHitAt: a.last_hit_at,
      createdAt: a.created_at,
    })),
    workerHits: (wHitsRes.data ?? []).map((n) => {
      const p = (n.payload ?? {}) as Record<string, unknown>;
      const pick = (key: string) => String((locale === "ru" ? p[`${key}_ru`] : null) ?? p[key] ?? "");
      return {
        id: n.id,
        name: String(p.name ?? ""),
        profession: pick("profession"),
        region: pick("region"),
        experience: typeof p.experience === "string" && EXP.has(p.experience) ? (p.experience as Enums<"experience_level">) : null,
        salary: typeof p.salary === "number" ? p.salary : null,
        link: n.link && n.link.startsWith("/") ? n.link : "/search",
        createdAt: n.created_at,
      };
    }),
    telegramConnected: tgRes.data?.bot_started === true,
    botConfigured: !!bot,
    free: paidRes.data === false,
    paidUntil,
    price: Number(priceRes.data?.value ?? 15000) || 15000,
    providers: enabledProviders(),
    inApp,
  };
}

export interface AiProTeaser {
  free: boolean;
  price: number;
  /** Obuna tugash vaqti (faol bo'lsa) */
  paidUntil: string | null;
  /** Google Play ilovasi ichida — narx ko'rsatilmaydi */
  inApp: boolean;
}

/** Bosh sahifa va kabinetdagi "AI yordamchi · PRO" kartasi uchun: narx, bepul rejim, obuna holati */
export async function getAiProTeaser(userId: string | null): Promise<AiProTeaser> {
  const supabase = await createClient();
  const [paidRes, priceRes, subRes, inApp] = await Promise.all([
    supabase.rpc("ai_alerts_paid"),
    supabase.from("app_settings").select("value").eq("key", "price_ai_alerts").maybeSingle(),
    userId ? supabase.from("ai_alert_subscriptions").select("paid_until").eq("profile_id", userId).maybeSingle() : Promise.resolve({ data: null }),
    isAndroidApp(),
  ]);
  const until = subRes.data?.paid_until ?? null;
  return {
    free: paidRes.data === false,
    price: Number(priceRes.data?.value ?? 15000) || 15000,
    paidUntil: until && new Date(until) > new Date() ? until : null,
    inApp,
  };
}
