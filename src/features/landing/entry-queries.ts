import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

/** Kirish oynasi va tanishtiruv uchun haqiqiy sonlar (soxta "10 000+ vakansiya" yo'q). Xato bo'lsa — null, son ko'rsatilmaydi. */
export interface EntryStats {
  /** faol va muddati o'tmagan vakansiyalar */
  vacancies: number;
  /** bugun (Toshkent vaqti) e'lon qilinganlar */
  today: number;
  /** qidiruvda ko'rinadigan ishchi e'lonlari */
  workers: number;
}

/** Toshkent (UTC+5, yozgi vaqtsiz) bo'yicha bugungi kun boshi, ISO */
export function tashkentDayStart(now: number): string {
  const local = new Date(now + 5 * 3600_000);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - 5 * 3600_000).toISOString();
}

async function loadStats(): Promise<EntryStats> {
  const db = createPublicClient();
  const now = Date.now();
  // jami — qidiruvdagi bilan bir xil qoida (bozor paneli kabi); bugungi — faol, muddati o'tmagan, bugun e'lon qilingan
  const [jobs, workers, today] = await Promise.all([
    db.rpc("simple_search_vacancies", { p_remote: false, p_no_experience: false, p_limit: 1, p_offset: 0 }),
    db.rpc("simple_search_workers", { p_remote: false, p_experienced: false, p_limit: 1, p_offset: 0 }),
    db
      .from("vacancies")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .or(`expires_at.is.null,expires_at.gt.${new Date(now).toISOString()}`)
      .gte("published_at", tashkentDayStart(now)),
  ]);
  // xato keshlanmasin
  const failed = jobs.error ?? workers.error ?? today.error;
  if (failed) throw new Error(`entry_stats: ${failed.message}`);
  return { vacancies: Number(jobs.data?.[0]?.total_count ?? 0), today: today.count ?? 0, workers: Number(workers.data?.[0]?.total_count ?? 0) };
}

// bozor paneli bilan bir xil kesh qoidasi: MARKET_CACHE_SECONDS=0 — keshsiz (E2E stend)
const TTL = Number(process.env.MARKET_CACHE_SECONDS ?? 600);
const cachedStats = unstable_cache(loadStats, ["entry-stats-v1"], { revalidate: TTL > 0 ? TTL : 600, tags: ["market"] });

/** Bitta so'rov davomida bir marta (kirish oynasi va tanishtiruv birga so'raydi) */
export const getEntryStats = cache(async (): Promise<EntryStats | null> => {
  try {
    return TTL > 0 ? await cachedStats() : await loadStats();
  } catch (error) {
    console.warn("[entry] stats", error instanceof Error ? error.message : error);
    return null;
  }
});
