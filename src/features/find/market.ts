import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

export interface TopEmployer {
  slug: string;
  name: string;
  logoUrl: string | null;
  verified: boolean;
  /** faol ish o'rinlari soni (aniq) */
  count: number;
}

export interface MarketOverview {
  /** faol ish e'lonlari (qidiruvdagi bilan bir xil qoida) */
  jobs: number;
  /** ochiq ishchi e'lonlari (rezyumelar) */
  workers: number;
  /** faol e'loni bor kompaniyalar */
  companies: number;
  top: TopEmployer[];
}

const TOP = 6;

async function load(): Promise<MarketOverview> {
  const db = createPublicClient();
  const [jobs, workers, companies, recent] = await Promise.all([
    db.rpc("simple_search_vacancies", { p_remote: false, p_no_experience: false, p_limit: 1, p_offset: 0 }),
    db.rpc("simple_search_workers", { p_remote: false, p_experienced: false, p_limit: 1, p_offset: 0 }),
    db.from("companies").select("id, vacancies!inner(id)", { count: "exact", head: true }).eq("vacancies.status", "active"),
    // eng faol ish beruvchilar: oxirgi faol e'lonlar orasidan (tartib uchun); soni — pastda aniq sanaladi
    db
      .from("vacancies")
      .select("company_id, company:companies(slug, name, logo_url, verification_status)")
      .eq("status", "active")
      .not("company_id", "is", null)
      .order("published_at", { ascending: false })
      .limit(500),
  ]);
  // xato keshlanmasin (unstable_cache faqat muvaffaqiyatli natijani saqlaydi)
  const failed = jobs.error ?? workers.error ?? companies.error ?? recent.error;
  if (failed) throw new Error(`market_overview: ${failed.message}`);

  const byCompany = new Map<string, { slug: string; name: string; logoUrl: string | null; verified: boolean; n: number }>();
  for (const row of recent.data ?? []) {
    const c = row.company;
    if (!row.company_id || !c) continue;
    const cur = byCompany.get(row.company_id);
    if (cur) cur.n += 1;
    else byCompany.set(row.company_id, { slug: c.slug, name: c.name, logoUrl: c.logo_url, verified: c.verification_status === "verified", n: 1 });
  }
  const leaders = [...byCompany.entries()].sort((a, b) => b[1].n - a[1].n || a[1].name.localeCompare(b[1].name)).slice(0, TOP);
  const counts = await Promise.all(
    leaders.map(([id]) => db.from("vacancies").select("id", { count: "exact", head: true }).eq("status", "active").eq("company_id", id)),
  );
  const top = leaders.map(([, c], i) => ({ slug: c.slug, name: c.name, logoUrl: c.logoUrl, verified: c.verified, count: counts[i]?.count ?? c.n }));

  return {
    jobs: Number(jobs.data?.[0]?.total_count ?? 0),
    workers: Number(workers.data?.[0]?.total_count ?? 0),
    companies: companies.count ?? 0,
    top,
  };
}

// kesh muddati (soniya): prod — 10 daqiqa; MARKET_CACHE_SECONDS=0 — keshsiz (E2E stend: testlar o'z ma'lumotini darhol ko'radi)
const TTL = Number(process.env.MARKET_CACHE_SECONDS ?? 600);
const cached = unstable_cache(load, ["market-overview-v1"], { revalidate: TTL > 0 ? TTL : 600, tags: ["market"] });

/** Bozor holati (kompyuterdagi o'ng panel uchun): 10 daqiqa keshlanadi; xato bo'lsa — null (panel ko'rsatilmaydi) */
export const getMarketOverview = cache(async (): Promise<MarketOverview | null> => {
  try {
    return TTL > 0 ? await cached() : await load();
  } catch (error) {
    console.warn("[find] market", error instanceof Error ? error.message : error);
    return null;
  }
});
