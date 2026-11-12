import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient, REFERENCE_CACHE } from "@/lib/supabase/public";
import { getRegions } from "@/lib/reference";
import type { MasterSearchParams } from "./schema";
import {
  MASTER_PAGE_SIZE,
  type MasterCategory,
  type MasterDetail,
  type MasterPublic,
  type MasterRequest,
  type MasterReview,
  type MyMasterListing,
} from "./types";

/** Xizmat kategoriyalari (12 ta) — ma'lumotnoma kabi keshlanadi (1 soat, admin o'zgartirsa "reference" tegi) */
const loadCategories = unstable_cache(
  async (): Promise<MasterCategory[]> => {
    const { data, error } = await createPublicClient()
      .from("master_categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["ref:master_categories"],
  REFERENCE_CACHE,
);
export const getMasterCategories = cache(
  async (): Promise<MasterCategory[]> => {
    try {
      return await loadCategories();
    } catch (e) {
      console.error("[masters] categories", e instanceof Error ? e.message : e);
      return [];
    }
  },
);

export const MASTERS_TAG = "masters";
/** Kategoriya bo'yicha faol e'lonlar soni (demo bilan va demosiz) — 60 s kesh; moderatsiya/joylash updateTag bilan yangilaydi */
const loadCounts = unstable_cache(
  async () => loadCountsFresh(),
  ["masters-category-counts-v1"],
  { revalidate: 60, tags: [MASTERS_TAG] },
);
// bozor paneli bilan bir xil qoida: MARKET_CACHE_SECONDS=0 (E2E stend) — keshsiz
const COUNTS_CACHED = Number(process.env.MARKET_CACHE_SECONDS ?? 600) > 0;
async function loadCountsFresh(): Promise<
  Record<string, { active: number; real: number }>
> {
  const { data, error } = await createPublicClient().rpc(
    "master_category_counts",
  );
  if (error) throw new Error(error.message);
  return Object.fromEntries(
    (data ?? []).map((r) => [
      r.category_id,
      { active: Number(r.active_count), real: Number(r.real_count) },
    ]),
  );
}
export async function getMasterCategoryCounts(): Promise<Record<
  string,
  { active: number; real: number }
> | null> {
  try {
    return COUNTS_CACHED ? await loadCounts() : await loadCountsFresh();
  } catch (e) {
    console.error("[masters] counts", e instanceof Error ? e.message : e);
    return null;
  }
}

export interface MasterSearchResult {
  items: MasterPublic[];
  total: number;
}

/** Ommaviy qidiruv (telefonsiz). Xato — null (sahifa halol "vaqtincha ochilmadi" deydi) */
export async function searchMasters(
  p: Partial<MasterSearchParams> & { limit?: number },
): Promise<MasterSearchResult | null> {
  const [categories, regions] = await Promise.all([
    getMasterCategories(),
    getRegions(),
  ]);
  const category = p.category
    ? (categories.find((c) => c.slug === p.category) ?? null)
    : null;
  const region = p.region
    ? (regions.find((r) => r.slug === p.region) ?? null)
    : null;
  if ((p.category && !category) || (p.region && !region))
    return { items: [], total: 0 };
  const limit = p.limit ?? MASTER_PAGE_SIZE;
  const { data, error } = await createPublicClient().rpc(
    "master_listings_public",
    {
      p_category: category?.id ?? undefined,
      p_region: region?.id ?? undefined,
      p_query: p.q || undefined,
      p_min_experience: p.exp || undefined,
      p_sort: p.sort ?? "new",
      p_limit: limit,
      p_offset: ((p.page ?? 1) - 1) * limit,
    },
  );
  if (error) {
    console.error("[masters] search", error.code, error.message);
    return null;
  }
  const items = data ?? [];
  return { items, total: Number(items[0]?.total_count ?? 0) };
}

/** Bitta e'lon (faqat faol); topilmasa null */
export const getMasterBySlug = cache(
  async (slug: string): Promise<MasterDetail | null> => {
    if (!/^[a-z0-9-]{3,140}$/.test(slug)) return null;
    const { data, error } = await createPublicClient().rpc(
      "master_listing_public",
      { p_slug: slug },
    );
    if (error) {
      console.error("[masters] detail", error.code, error.message);
      return null;
    }
    return data?.[0] ?? null;
  },
);

export async function getMasterReviews(
  listingId: string,
  limit = 20,
): Promise<
  Array<
    MasterReview & {
      author: { first_name: string | null; last_name: string | null } | null;
    }
  >
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("master_reviews")
    .select(
      "*, author:profiles!master_reviews_author_profile_id_fkey(first_name, last_name)",
    )
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[masters] reviews", error.message);
    return [];
  }
  return (data ?? []) as Array<
    MasterReview & {
      author: { first_name: string | null; last_name: string | null } | null;
    }
  >;
}

/** Egasining e'lonlari (barcha holatlar). Aniq filtr: admin RLS bo'yicha hammasini ko'radi — kabinetda faqat o'ziniki */
export async function getMyMasterListings(
  userId: string,
): Promise<MyMasterListing[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("master_listings")
    .select("*")
    .eq("owner_profile_id", userId)
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("[masters] mine", error.message);
    return [];
  }
  return data ?? [];
}

export async function getMyMasterListing(
  id: string,
): Promise<MyMasterListing | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("master_listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

/** Egasining e'lonlariga kelgan so'rovlar (yangisi birinchi); o'zi mijoz sifatida yuborganlari bu yerga kirmaydi */
export async function getMyMasterRequests(
  userId: string,
  limit = 50,
): Promise<
  Array<MasterRequest & { listing: { id: string; title: string } | null }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("master_requests")
    .select("*, listing:master_listings!inner(id, title, owner_profile_id)")
    .eq("listing.owner_profile_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[masters] requests", error.message);
    return [];
  }
  return (data ?? []) as Array<
    MasterRequest & { listing: { id: string; title: string } | null }
  >;
}

/** Admin: moderatsiya navbati va umumiy holat */
export async function getMasterModerationQueue(
  all = false,
): Promise<
  Array<
    MyMasterListing & {
      owner: { first_name: string | null; last_name: string | null } | null;
    }
  >
> {
  const supabase = await createClient();
  let q = supabase
    .from("master_listings")
    .select(
      "*, owner:profiles!master_listings_owner_profile_id_fkey(first_name, last_name)",
    )
    .eq("is_demo", false)
    .order("created_at", { ascending: true })
    .limit(100);
  if (!all) q = q.eq("status", "pending_review");
  const { data, error } = await q;
  if (error) {
    console.error("[masters] queue", error.message);
    return [];
  }
  return (data ?? []) as Array<
    MyMasterListing & {
      owner: { first_name: string | null; last_name: string | null } | null;
    }
  >;
}

export async function getMasterAdminStats(): Promise<{
  active: number;
  pending: number;
  demo: number;
}> {
  const supabase = await createClient();
  const [active, pending, demo] = await Promise.all([
    supabase
      .from("master_listings")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .eq("is_demo", false),
    supabase
      .from("master_listings")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review"),
    supabase
      .from("master_listings")
      .select("id", { count: "exact", head: true })
      .eq("is_demo", true),
  ]);
  return {
    active: active.count ?? 0,
    pending: pending.count ?? 0,
    demo: demo.count ?? 0,
  };
}
