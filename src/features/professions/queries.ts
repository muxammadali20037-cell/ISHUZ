import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { publicEnv } from "@/lib/env";
import type { ProfessionNode, ProfessionSearchHit, TrailItem } from "./types";

/**
 * Kasblar daraxti — ochiq ma'lumot. Cookie'siz anon client: javoblar CDN'da keshlanishi mumkin.
 * Butun daraxt hech qachon bir martada yuklanmaydi — faqat kerakli daraja.
 */
function anon() {
  return createSupabaseClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
}

const NODE_COLUMNS = "id, parent_id, category_id, name_uz, name_ru, name_en, icon, selectable, is_popular";

/** Bir daraja: soha ildizlari (parentId yo'q) yoki tugunning bolalari */
export async function getProfessionChildren(opts: { categoryId?: string | null; parentId?: string | null }): Promise<ProfessionNode[]> {
  const db = anon();
  let q = db.from("profession_nodes").select(NODE_COLUMNS).eq("is_active", true).order("sort_order").order("name_uz").limit(500);
  if (opts.parentId) q = q.eq("parent_id", opts.parentId);
  else if (opts.categoryId) q = q.is("parent_id", null).eq("category_id", opts.categoryId);
  else return [];
  const { data, error } = await q;
  if (error || !data?.length) return [];
  const ids = data.map((n) => n.id);
  const { data: kids } = await db.from("profession_nodes").select("parent_id").eq("is_active", true).in("parent_id", ids);
  const withKids = new Set((kids ?? []).map((k) => k.parent_id));
  return data.map((n) => ({ ...n, has_children: withKids.has(n.id) }));
}

export async function searchProfessions(query: string, categoryId?: string | null, limit = 20): Promise<ProfessionSearchHit[]> {
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  const { data, error } = await anon().rpc("search_profession_nodes", { p_query: q, p_category_id: categoryId ?? undefined, p_limit: limit });
  if (error) {
    console.error("[professions] search", error.message);
    return [];
  }
  return (data ?? []).map((h) => ({
    id: h.id,
    parent_id: h.parent_id,
    category_id: h.category_id,
    name_uz: h.name_uz,
    name_ru: h.name_ru,
    name_en: h.name_en,
    icon: h.icon,
    selectable: h.selectable,
    has_children: h.has_children,
    trail: (h.trail as unknown as TrailItem[]) ?? [],
  }));
}

/** Tugunning to'liq yo'li (o'zi ham) */
export async function getProfessionTrail(nodeId: string | null | undefined): Promise<TrailItem[]> {
  if (!nodeId) return [];
  const { data } = await anon().rpc("profession_node_trail", { p_node_id: nodeId });
  return (data ?? []).map((t) => ({ id: t.id, name_uz: t.name_uz, name_ru: t.name_ru, name_en: t.name_en }));
}

/**
 * Erkin matndan aniq kasbni topish (AI natijasi, vakansiya nomi): "3 yil tajribali yurak jarrohi kerak" → Kardiojarroh.
 * Avval to'liq iboralar (nom/sarlavha), keyin matndagi 2 va 1 so'zli bo'laklar qidiriladi; faqat shu sohadagi,
 * tanlanadigan va ishonchli (aniq yoki boshlanishi mos) natija olinadi — shubhali bo'lsa null (foydalanuvchi o'zi tanlaydi).
 */
export async function resolveProfessionNode(texts: Array<string | null | undefined>, categoryId: string | null): Promise<string | null> {
  if (!categoryId) return null;
  const phrases = texts.map((t) => (t ?? "").trim()).filter((t) => t.length >= 3);
  const words = phrases
    .join(" ")
    .toLowerCase()
    .split(/[^\p{L}\p{N}'’ʻ-]+/u)
    .filter((w) => w.length >= 3);
  const grams = [...phrases, ...words.slice(0, -1).map((w, i) => `${w} ${words[i + 1]}`), ...words.filter((w) => w.length >= 4)];
  const unique = [...new Set(grams)].slice(0, 14);
  let best: { id: string; score: number } | null = null;
  const db = anon();
  for (const q of unique) {
    const { data } = await db.rpc("search_profession_nodes", { p_query: q.slice(0, 80), p_category_id: categoryId, p_limit: 3 });
    for (const h of data ?? []) {
      if (!h.selectable || h.score < 2) continue;
      // uzunroq (aniqroq) ibora bo'yicha topilgani afzal
      const score = h.score + q.split(" ").length * 0.25 + h.depth * 0.05;
      if (!best || score > best.score) best = { id: h.id, score };
    }
  }
  return best?.id ?? null;
}
