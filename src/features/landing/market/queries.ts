import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { parseMarketCounts, type MarketCounts } from "./model";

async function load(): Promise<MarketCounts> {
  const { data, error } = await createPublicClient().rpc("home_market_counts");
  // xato (yoki 0067 hali qo'llanmagan) keshlanmasin — chaqiruvchi null oladi va son ko'rsatmaydi
  if (error) throw new Error(`market_counts: ${error.code ?? ""} ${error.message}`);
  const parsed = parseMarketCounts(data);
  if (!parsed) throw new Error("market_counts: shape");
  return parsed;
}

// bozor paneli bilan bir xil kesh qoidasi: MARKET_CACHE_SECONDS=0 — keshsiz (E2E stend)
const TTL = Number(process.env.MARKET_CACHE_SECONDS ?? 600);
const cached = unstable_cache(load, ["home-market-counts-v1"], { revalidate: TTL > 0 ? TTL : 600, tags: ["market"] });

/** Soha bo'yicha faol vakansiyalar va faol ish beruvchilar. Xato bo'lsa — null: sonlar ko'rsatilmaydi (soxta raqam yo'q) */
export const getMarketCounts = cache(async (): Promise<MarketCounts | null> => {
  try {
    return TTL > 0 ? await cached() : await load();
  } catch (error) {
    console.warn("[home] market counts", error instanceof Error ? error.message : error);
    return null;
  }
});
