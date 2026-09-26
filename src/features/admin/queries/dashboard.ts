import "server-only";

import { cache } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const statsSchema = z.object({
  total_users: z.coerce.number().default(0),
  workers: z.coerce.number().default(0),
  employers: z.coerce.number().default(0),
  verified_employers: z.coerce.number().default(0),
  active_vacancies: z.coerce.number().default(0),
  pending_vacancies: z.coerce.number().default(0),
  applications: z.coerce.number().default(0),
  hires: z.coerce.number().default(0),
  new_registrations_7d: z.coerce.number().default(0),
  open_reports: z.coerce.number().default(0),
  pending_verifications: z.coerce.number().default(0),
  dau: z.coerce.number().default(0),
  wau: z.coerce.number().default(0),
  mau: z.coerce.number().default(0),
});

export type AdminStats = z.infer<typeof statsSchema>;
export type StatKey = keyof AdminStats;

/** rpc admin_stats() → tiplangan obyekt. Ruxsat bo'lmasa (42501) null. */
export const getAdminStats = cache(async (): Promise<{ stats: AdminStats | null; error: string | null }> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_stats");
  if (error) return { stats: null, error: error.message };
  const parsed = statsSchema.safeParse(data ?? {});
  return { stats: parsed.success ? parsed.data : null, error: parsed.success ? null : "invalid_stats" };
});

export interface DailyStat {
  day: string;
  registrations: number;
  vacancies: number;
  applications: number;
  hires: number;
}

export const DAILY_METRICS = ["registrations", "vacancies", "applications", "hires"] as const;
export type DailyMetric = (typeof DAILY_METRICS)[number];

/** rpc admin_daily_stats(days) */
export const getDailyStats = cache(async (days: number): Promise<{ rows: DailyStat[]; error: string | null }> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_daily_stats", { p_days: days });
  if (error) return { rows: [], error: error.message };
  return {
    rows: (data ?? []).map((r) => ({
      day: r.day,
      registrations: Number(r.registrations ?? 0),
      vacancies: Number(r.vacancies ?? 0),
      applications: Number(r.applications ?? 0),
      hires: Number(r.hires ?? 0),
    })),
    error: null,
  };
});

export function sumDaily(rows: DailyStat[]): Record<DailyMetric, number> {
  return rows.reduce(
    (acc, r) => {
      acc.registrations += r.registrations;
      acc.vacancies += r.vacancies;
      acc.applications += r.applications;
      acc.hires += r.hires;
      return acc;
    },
    { registrations: 0, vacancies: 0, applications: 0, hires: 0 },
  );
}

export interface SidebarCounts {
  reports: number;
  verifications: number;
  vacancies: number;
  reviews: number;
}

/** Yon panel uchun navbatlar soni (RLS ruxsat bermasa 0 qaytadi) */
export const getSidebarCounts = cache(async (): Promise<SidebarCounts> => {
  const supabase = await createClient();
  const [reports, verifications, vacancies, reviews] = await Promise.all([
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("verification_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("vacancies").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  return {
    reports: reports.count ?? 0,
    verifications: verifications.count ?? 0,
    vacancies: vacancies.count ?? 0,
    reviews: reviews.count ?? 0,
  };
});
