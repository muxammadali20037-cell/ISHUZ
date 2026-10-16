import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { MatchReason } from "@/components/shared/match-score";
import { parseReasons } from "./queries";

/** Moslik tahlili (matching v2, `match_explain`): faqat haqiqatan hisoblangan natija — o'ylab topilgan foiz yo'q */
export interface FitAnalysis {
  /** 0–100; faqat `complete` va qat'iy talablar mos bo'lsa ko'rsatiladi */
  score: number;
  hardFail: boolean;
  complete: boolean;
  /** yetishmayotgan ma'lumot: profession | location | experience | skills | languages */
  missing: string[];
  reasons: MatchReason[];
}

const MISSING = new Set(["profession", "location", "experience", "skills", "languages"]);

/** Server (RLS + funksiya ichida egalik tekshiruvi): faqat ishchi o'zi, admin yoki vakansiya egasi (nomzodni ko'rish huquqi bilan) */
export async function getFitAnalysis(workerId: string, vacancyId: string): Promise<FitAnalysis | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("match_explain", { p_worker_id: workerId, p_vacancy_id: vacancyId });
  if (error) {
    console.warn("[fit] match_explain", error.code, error.message);
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const m = data as Record<string, unknown>;
  const score = Number(m.score);
  if (!Number.isFinite(score)) return null;
  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    hardFail: m.hard_fail === true,
    complete: m.complete === true,
    missing: Array.isArray(m.missing) ? m.missing.filter((x): x is string => typeof x === "string" && MISSING.has(x)) : [],
    reasons: parseReasons(m.reasons as never),
  };
}
