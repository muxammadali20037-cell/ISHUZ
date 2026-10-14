import "server-only";

import { randomBytes } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import { getSearchDictionary } from "@/features/search/dictionary";
import { normalizeText, understandQuery } from "@/features/search/understand";
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
  salaryMin: number | null;
  salaryKind: "monthly" | "daily" | "hourly" | null;
  schedules: ("5_2" | "6_1" | "2_2" | "shift" | "flexible")[];
  noExperience: boolean;
  experienceMonths: number | null;
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
    salaryMin: u.salaryMin,
    salaryKind: u.salaryKind,
    schedules: u.schedules,
    noExperience: u.noExperience,
    experienceMonths: u.experienceMonths,
  };
}

export interface NodeInfo {
  id: string;
  trail: TrailItem[];
  categorySlug: string | null;
  categoryIcon: string | null;
}

/** Umumiy "Kunlik ish (mardikor)" tuguni: "kunlik ish" deb yozilganda kasb emas, haq turi deb tushuniladi */
const DAY_LABOR_SLUG = "other-day-labor";
const dayLabor = new Map<string, boolean>();
export async function isDayLaborNode(nodeId: string): Promise<boolean> {
  const hit = dayLabor.get(nodeId);
  if (hit !== undefined) return hit;
  const { data } = await anon().from("profession_nodes").select("slug").eq("id", nodeId).maybeSingle();
  const value = data?.slug === DAY_LABOR_SLUG;
  if (dayLabor.size > 2000) dayLabor.clear();
  dayLabor.set(nodeId, value);
  return value;
}

/** Kasb tuguni. null — bunday tugun yo'q; texnik xato — istisno (xato sahifasi "Qayta urinish" bilan, URL saqlanadi) */
export async function getNodeInfo(nodeId: string): Promise<NodeInfo | null> {
  const db = anon();
  const [trail, { data: node, error }] = await Promise.all([getProfessionTrail(nodeId), db.from("profession_nodes").select("id, categories(slug, icon)").eq("id", nodeId).maybeSingle()]);
  if (error) throw new Error(`node_lookup_failed:${error.code ?? ""}`);
  if (node && !trail.length) throw new Error("node_trail_failed");
  if (!node) return null;
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

/**
 * Qidiruv natijasi: muvaffaqiyat (0 ta ham bo'lishi mumkin) yoki texnik xato — ular aralashmaydi.
 * Xato "natija yo'q" deb ko'rsatilmaydi va bo'sh qidiruv statistikasiga yozilmaydi; errorId — logdagi yozuvni topish uchun.
 */
export type FindOutcome<T> = ({ ok: true } & FindResults<T>) | { ok: false; errorId: string };

function searchFailure(scope: "jobs" | "workers", error: { code?: string; message: string }): { ok: false; errorId: string } {
  const errorId = randomBytes(4).toString("hex");
  // shaxsiy ma'lumotsiz: so'rov matni yozilmaydi
  console.error(JSON.stringify({ find_error: scope, id: errorId, code: error.code ?? null, message: error.message.slice(0, 160) }));
  return { ok: false, errorId };
}

interface Place {
  regionId: string | null;
  districtId: string | null;
  remote: boolean;
}

/** `limit` — sahifa hajmi (standart PAGE_SIZE; qidiruv boshidagi "Yangi e'lonlar" — bir nechta) */
export async function findJobs(params: FindParams, place: Place, limit = PAGE_SIZE): Promise<FindOutcome<JobRow>> {
  const supabase = await createClient();
  const args = {
    p_profession_node_id: params.p ?? undefined,
    p_region_id: place.regionId ?? undefined,
    p_district_id: place.districtId ?? undefined,
    p_remote: place.remote,
    p_salary_min: params.salary ?? undefined,
    p_schedule: params.schedule ?? undefined,
    p_no_experience: params.noexp,
    p_limit: limit,
    p_offset: (params.page - 1) * limit,
  };
  let { data, error } = params.pay === "daily" ? await supabase.rpc("simple_search_vacancies_v2", { ...args, p_salary_type: "daily" }) : await supabase.rpc("simple_search_vacancies", args);
  let pageOnly = false;
  if (error && params.pay === "daily" && (error.code === "PGRST202" || error.code === "42883")) {
    // 0060 hali qo'llanmagan: shu sahifadagi natijalardan kunliklari (umumiy son — taxminiy)
    ({ data, error } = await supabase.rpc("simple_search_vacancies", args));
    data = (data ?? []).filter((r) => r.salary_type === "daily");
    pageOnly = true;
  }
  if (error) return searchFailure("jobs", error);
  const items = data ?? [];
  const [images, photoRows] = await Promise.all([
    getProfessionImages(items.map((r) => r.profession_node_id)),
    items.length ? supabase.from("vacancies").select("id, photo_path").in("id", items.map((r) => r.id)).not("photo_path", "is", null) : Promise.resolve({ data: [] }),
  ]);
  const photos = Object.fromEntries((photoRows.data ?? []).filter((r) => r.photo_path).map((r) => [r.id, r.photo_path as string]));
  return { ok: true, items, total: pageOnly ? items.length : Number(items[0]?.total_count ?? 0), images, photos };
}

export async function findWorkers(params: FindParams, place: Place, limit = PAGE_SIZE): Promise<FindOutcome<WorkerRow>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("simple_search_workers", {
    p_profession_node_id: params.p ?? undefined,
    p_region_id: place.regionId ?? undefined,
    p_district_id: place.districtId ?? undefined,
    p_remote: place.remote,
    p_experienced: params.exp,
    p_limit: limit,
    p_offset: (params.page - 1) * limit,
  });
  if (error) return searchFailure("workers", error);
  const items = data ?? [];
  const images = await getProfessionImages(items.map((r) => r.profession_node_id));
  return { ok: true, items, total: Number(items[0]?.total_count ?? 0), images };
}

export type { JobRow, WorkerRow };

/** /search natijasini qayd etish (statistika: eng ko'p qidirilgan kasblar, hududlar talabi, bo'sh natijalar) */
export async function logFindSearch(input: { scope: "jobs" | "workers"; query: string; understood: Record<string, Json | undefined>; results: number; profileId: string | null }): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const query = input.query.replace(/\s+/g, " ").trim().slice(0, 200);
  if (!query) return;
  try {
    const understood = Object.fromEntries(Object.entries(input.understood).filter(([, v]) => v !== null && v !== undefined && v !== false)) as { [key: string]: Json };
    await createAdminClient()
      .from("search_logs")
      .insert({ scope: input.scope, query, query_norm: normalizeText(query).slice(0, 200) || query, understood, results_count: Math.max(0, input.results), profile_id: input.profileId });
  } catch (error) {
    console.warn("[find] log", error instanceof Error ? error.message : error);
  }
}
