import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { DemoVacancy, DemoVacancyDetail, DemoVacancyList } from "./types";

export const DEMO_VACANCIES_TAG = "demo-vacancies";

/** stendda (MARKET_CACHE_SECONDS=0) kesh yo'q — testlar bazadagi o'zgarishni darhol ko'radi */
const TTL = process.env.MARKET_CACHE_SECONDS === "0" ? 0 : 300;

export interface DemoVacancyQuery {
  category?: string | null;
  region?: string | null;
  query?: string | null;
  limit?: number;
  offset?: number;
}

/**
 * Namuna (demo) vakansiyalar — haqiqiy e'lonlardan alohida jadval (0077). Xato (masalan, migratsiya hali qo'llanmagan) —
 * bo'sh ro'yxat: namuna bloki shunchaki ko'rinmaydi, sahifa buzilmaydi.
 */
async function load({ category = null, region = null, query = null, limit = 12, offset = 0 }: DemoVacancyQuery): Promise<DemoVacancyList> {
  try {
    const { data, error } = await createPublicClient().rpc("demo_vacancies_public", {
      p_category: category ?? undefined,
      p_region: region ?? undefined,
      p_query: query ?? undefined,
      p_limit: limit,
      p_offset: offset,
    });
    if (error || !data) return { items: [], total: 0 };
    const rows = data as (DemoVacancy & { total_count: number })[];
    const items = rows.map((r) => {
      const row: DemoVacancy & { total_count?: number } = { ...r };
      delete row.total_count;
      return row as DemoVacancy;
    });
    return { items, total: Number(rows[0]?.total_count ?? 0) };
  } catch {
    return { items: [], total: 0 };
  }
}

const cached = unstable_cache(load, ["demo-vacancies-v1"], { revalidate: TTL || 1, tags: [DEMO_VACANCIES_TAG] });

export function getDemoVacancies(q: DemoVacancyQuery = {}): Promise<DemoVacancyList> {
  // qidiruv matni bilan — keshsiz (kalitlar ko'payib ketmasin)
  return TTL && !q.query ? cached(q) : load(q);
}

export async function getDemoVacancy(slug: string): Promise<DemoVacancyDetail | null> {
  if (!/^namuna-[a-z0-9-]{3,80}$/.test(slug)) return null;
  try {
    const { data, error } = await createPublicClient().rpc("demo_vacancy_public", { p_slug: slug });
    if (error || !data?.length) return null;
    return data[0] as DemoVacancyDetail;
  } catch {
    return null;
  }
}

/** Admin sahifasi: namunalar soni (jadval yo'q bo'lsa — null: "migratsiya qo'llanmagan") */
export async function getDemoVacancyCount(): Promise<number | null> {
  try {
    const { data, error } = await createPublicClient().rpc("demo_vacancies_public", { p_limit: 1, p_offset: 0 });
    if (error) return null;
    return Number((data as { total_count: number }[] | null)?.[0]?.total_count ?? 0);
  } catch {
    return null;
  }
}
