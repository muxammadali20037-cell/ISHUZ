import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCategories, type Category } from "@/lib/reference";
import type { SessionContext } from "@/features/auth/session";
import { isMissingRelation } from "@/features/saved/missing";
import { tashkentDayStart } from "@/features/landing/entry-queries";

/**
 * "Mening dunyom" (2026-11): foydalanuvchi tanlagan sohalar (profile_interests, 0073). `supported: false` — migratsiya hali
 * qo'llanmagan bazada: dunyo oqimi ko'rsatilmaydi (soxta holat yo'q).
 */
export interface MyInterests {
  supported: boolean;
  categories: Category[];
}

export const getMyInterests = cache(async (userId: string | null | undefined): Promise<MyInterests> => {
  if (!userId) return { supported: true, categories: [] };
  const supabase = await createClient();
  const [{ data, error, status }, all] = await Promise.all([
    supabase.from("profile_interests").select("category_id, created_at").eq("profile_id", userId).order("created_at"),
    getCategories(),
  ]);
  if (error) {
    if (!isMissingRelation(error, status)) console.warn("[world] interests", error.message);
    return { supported: !isMissingRelation(error, status), categories: [] };
  }
  const byId = new Map(all.map((c) => [c.id, c]));
  return { supported: true, categories: (data ?? []).map((r) => byId.get(r.category_id)).filter((c): c is Category => !!c) };
});

/**
 * Kunlik reja: har bir qadam — foydalanuvchining haqiqiy holatidan (soxta "streak" yoki ball yo'q). Bugungi qadamlar (saqlash,
 * ariza) Toshkent vaqti bo'yicha har kuni yangilanadi.
 */
export interface DailyStep {
  key: "world" | "cv" | "save" | "apply" | "telegram";
  done: boolean;
  href: string;
  /** cv: profil to'liqligi (0–100) */
  percent?: number;
}

export async function getDailyPlan(session: SessionContext, hasInterests: boolean): Promise<DailyStep[]> {
  const supabase = await createClient();
  const since = tashkentDayStart(Date.now());
  const [worker, saved, applied, tg] = await Promise.all([
    session.workerId ? supabase.from("worker_profiles").select("completeness").eq("id", session.workerId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("saved_items").select("id", { count: "exact", head: true }).eq("profile_id", session.userId).not("vacancy_id", "is", null).gte("created_at", since),
    session.workerId
      ? supabase.from("applications").select("id", { count: "exact", head: true }).eq("worker_id", session.workerId).gte("created_at", since)
      : Promise.resolve({ count: 0 }),
    supabase.from("telegram_accounts").select("bot_started").eq("profile_id", session.userId).maybeSingle(),
  ]);
  const completeness = worker.data?.completeness ?? 0;
  return [
    { key: "world", done: hasInterests, href: "/dunyo" },
    { key: "cv", done: !!session.workerId && completeness >= 70, href: session.workerId ? "/profile" : "/post/worker", percent: session.workerId ? completeness : undefined },
    { key: "save", done: (saved.count ?? 0) > 0, href: "/jobs?sort=newest" },
    { key: "apply", done: (applied.count ?? 0) > 0, href: "/jobs?sort=newest" },
    { key: "telegram", done: !!tg.data?.bot_started, href: "/ai-alerts" },
  ];
}

/** Bugungi kun boshi (Toshkent) — "Yangi" belgisi uchun (komponentdan tashqarida: render toza qoladi) */
export function todayStartIso(): string {
  return tashkentDayStart(Date.now());
}
