import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getSearchDictionary } from "@/features/search/dictionary";
import { understandQuery } from "@/features/search/understand";
import { getProfessionTrail } from "@/features/professions/queries";
import type { TrailItem } from "@/features/professions/types";
import { getProfessionImages } from "@/lib/profession-images/server";
import { detectIntent, professionCandidates, type FindMode } from "./intent";
import type { FindParams } from "./params";

export const PAGE_SIZE = 20;

function anon() {
  return createSupabaseClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
}

export interface ResolvedQuery {
  mode: FindMode | null;
  nodeId: string | null;
  regionSlug: string | null;
  districtId: string | null;
  remote: boolean;
}

/**
 * Erkin matn → maqsad (ish/ishchi), aniq kasb (kasblar daraxtidan, lotin/kirill/rus nomlari va sinonimlar),
 * viloyat va tuman. AI ishlatilmaydi — natija faqat haqiqiy ma'lumotnomadan.
 */
export async function resolveFindQuery(q: string): Promise<ResolvedQuery> {
  const mode = detectIntent(q);
  const dict = await getSearchDictionary();
  const u = understandQuery(q, dict);
  const candidates = professionCandidates(q).slice(0, 12);
  const db = anon();
  const results = await Promise.all(candidates.map((c) => db.rpc("search_profession_nodes", { p_query: c.slice(0, 80), p_limit: 3 }).then((r) => ({ c, hits: r.data ?? [] }))));
  let best: { id: string; score: number } | null = null;
  for (const { c, hits } of results) {
    for (const h of hits) {
      if (!h.selectable || h.score < 2) continue;
      // uzunroq (aniqroq) ibora va aniq moslik afzal
      const score = h.score + c.split(" ").length * 0.3 - h.depth * 0.01;
      if (!best || score > best.score) best = { id: h.id, score };
    }
  }
  return {
    mode,
    nodeId: best?.id ?? null,
    regionSlug: u.region?.slug ?? null,
    districtId: u.districts.length === 1 ? u.districts[0]!.id : null,
    remote: u.remote,
  };
}

export interface NodeInfo {
  id: string;
  trail: TrailItem[];
  categorySlug: string | null;
  categoryIcon: string | null;
}

export async function getNodeInfo(nodeId: string): Promise<NodeInfo | null> {
  const db = anon();
  const [trail, { data: node }] = await Promise.all([getProfessionTrail(nodeId), db.from("profession_nodes").select("id, categories(slug, icon)").eq("id", nodeId).maybeSingle()]);
  if (!trail.length || !node) return null;
  const cat = node.categories as { slug: string; icon: string | null } | null;
  return { id: nodeId, trail, categorySlug: cat?.slug ?? null, categoryIcon: cat?.icon ?? null };
}

type JobRow = Database["public"]["Functions"]["simple_search_vacancies"]["Returns"][number];
type WorkerRow = Database["public"]["Functions"]["simple_search_workers"]["Returns"][number];

export interface FindResults<T> {
  items: T[];
  total: number;
  images: Record<string, string>;
  /** haqiqiy ish joyi suratlari (vakansiya id → yo'l) */
  photos?: Record<string, string>;
}

interface Place {
  regionId: string | null;
  districtId: string | null;
  remote: boolean;
}

export async function findJobs(params: FindParams, place: Place): Promise<FindResults<JobRow>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("simple_search_vacancies", {
    p_profession_node_id: params.p ?? undefined,
    p_region_id: place.regionId ?? undefined,
    p_district_id: place.districtId ?? undefined,
    p_remote: place.remote,
    p_salary_min: params.salary ?? undefined,
    p_schedule: params.schedule ?? undefined,
    p_no_experience: params.noexp,
    p_limit: PAGE_SIZE,
    p_offset: (params.page - 1) * PAGE_SIZE,
  });
  if (error) console.error("[find] jobs", error.message);
  const items = data ?? [];
  const [images, photoRows] = await Promise.all([
    getProfessionImages(items.map((r) => r.profession_node_id)),
    items.length ? supabase.from("vacancies").select("id, photo_path").in("id", items.map((r) => r.id)).not("photo_path", "is", null) : Promise.resolve({ data: [] }),
  ]);
  const photos = Object.fromEntries((photoRows.data ?? []).filter((r) => r.photo_path).map((r) => [r.id, r.photo_path as string]));
  return { items, total: Number(items[0]?.total_count ?? 0), images, photos };
}

export async function findWorkers(params: FindParams, place: Place): Promise<FindResults<WorkerRow>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("simple_search_workers", {
    p_profession_node_id: params.p ?? undefined,
    p_region_id: place.regionId ?? undefined,
    p_district_id: place.districtId ?? undefined,
    p_remote: place.remote,
    p_experienced: params.exp,
    p_limit: PAGE_SIZE,
    p_offset: (params.page - 1) * PAGE_SIZE,
  });
  if (error) console.error("[find] workers", error.message);
  const items = data ?? [];
  const images = await getProfessionImages(items.map((r) => r.profession_node_id));
  return { items, total: Number(items[0]?.total_count ?? 0), images };
}

export type { JobRow, WorkerRow };
