"use server";

import { unstable_cache } from "next/cache";
import { z } from "zod";
import { getT } from "@/lib/i18n/server";
import { createPublicClient } from "@/lib/supabase/public";
import { searchProfessions } from "@/features/professions/queries";
import { isProhibitedProfession } from "@/features/moderation/policy";

export interface ChatProfession {
  id: string;
  name: string;
  /** e'lon berishda faqat tanlanadigan (eng quyi) kasb; qidiruvda guruh ham bo'ladi */
  selectable: boolean;
}

interface Node {
  id: string;
  name_uz: string;
  name_ru: string;
  name_en: string | null;
  selectable: boolean;
}

const POPULAR_MAX = 30;

/**
 * Ommabop kasblar: ish qidirishda — faol vakansiyalari ko'p kasblar, ishchi qidirishda — e'loni ko'p kasblar; qolgani
 * daraxtdagi "ommabop" belgili kasblardan (ma'lumot hali kam bo'lsa ham ro'yxat bo'sh qolmaydi). Faqat ochiq (RLS bo'yicha hammaga ko'rinadigan) e'lonlar sanaladi; 10 daqiqa keshda.
 */
const popular = unstable_cache(
  async (mode: "jobs" | "workers"): Promise<Node[]> => {
    const db = createPublicClient();
    const rows =
      mode === "jobs"
        ? (await db.from("vacancies").select("profession_node_id").eq("status", "active").not("profession_node_id", "is", null).limit(2000)).data
        : (await db.from("worker_profiles").select("profession_node_id").eq("is_public", true).not("profession_node_id", "is", null).limit(2000)).data;
    const count = new Map<string, number>();
    for (const r of rows ?? []) if (r.profession_node_id) count.set(r.profession_node_id, (count.get(r.profession_node_id) ?? 0) + 1);
    const topIds = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, POPULAR_MAX).map(([id]) => id);
    const [byId, common] = await Promise.all([
      topIds.length ? db.from("profession_nodes").select("id, name_uz, name_ru, name_en, selectable").in("id", topIds) : Promise.resolve({ data: [] as Node[] }),
      db.from("profession_nodes").select("id, name_uz, name_ru, name_en, selectable").eq("is_popular", true).eq("selectable", true).eq("is_active", true).order("sort_order").order("name_uz").limit(POPULAR_MAX),
    ]);
    const nodes = new Map<string, Node>();
    for (const id of topIds) {
      const n = (byId.data ?? []).find((x) => x.id === id);
      if (n) nodes.set(n.id, n);
    }
    for (const n of common.data ?? []) {
      if (nodes.size >= POPULAR_MAX) break;
      if (![...nodes.values()].some((y) => y.name_uz === n.name_uz)) nodes.set(n.id, n);
    }
    return [...nodes.values()].filter((n) => !isProhibitedProfession(n));
  },
  ["chat:popular-professions"],
  { revalidate: 600, tags: ["professions"] },
);

export interface ChatProfessionCount extends ChatProfession {
  /** shu kasbdagi ochiq e'lonlar soni (butun O'zbekiston bo'yicha) */
  count: number;
}

/**
 * Hozir e'lonlari BOR kasblar (soni bilan) — qidiruv bo'sh chiqqanda "boshqa qidiruv" takliflari (ega, 2026-11-22: haqiqiy
 * ma'lumot, o'ylab topilgan e'lon yo'q). Ish qidirishda — faol vakansiyalar, ishchi qidirishda — ochiq ishchi e'lonlari.
 * Faqat RLS bo'yicha hammaga ko'rinadigan qatorlar sanaladi. Keshsiz: faqat "topilmadi" holatida chaqiriladi, soni esa
 * hozirgi bo'lishi kerak (keshdagi eski son bosilganda "topilmadi" chiqarishi mumkin edi).
 */
const withListings = async (mode: "jobs" | "workers"): Promise<Array<Node & { count: number }>> => {
  const db = createPublicClient();
  const nowIso = new Date().toISOString();
  const rows =
    mode === "jobs"
      ? (await db.from("vacancies").select("profession_node_id").eq("status", "active").or(`expires_at.is.null,expires_at.gt.${nowIso}`).not("profession_node_id", "is", null).limit(5000)).data
      : (await db.from("worker_profiles").select("profession_node_id").eq("is_public", true).not("profession_node_id", "is", null).limit(5000)).data;
  const count = new Map<string, number>();
  for (const r of rows ?? []) if (r.profession_node_id) count.set(r.profession_node_id, (count.get(r.profession_node_id) ?? 0) + 1);
  const top = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  if (!top.length) return [];
  const { data } = await db.from("profession_nodes").select("id, name_uz, name_ru, name_en, selectable").in("id", top.map(([id]) => id));
  return top
    .map(([id, n]) => {
      const node = (data ?? []).find((x) => x.id === id);
      return node ? { ...node, count: n } : null;
    })
    .filter((x): x is Node & { count: number } => !!x && !isProhibitedProfession(x));
};

export async function chatProfessionsWithListings(input: unknown): Promise<ChatProfessionCount[]> {
  const parsed = z.object({ mode: z.enum(["jobs", "workers"]), exclude: z.uuid().nullable().optional() }).safeParse(input);
  if (!parsed.success) return [];
  const { name } = await getT();
  try {
    return (await withListings(parsed.data.mode))
      .filter((n) => n.id !== parsed.data.exclude)
      .slice(0, 6)
      .map((n) => ({ id: n.id, name: name(n), selectable: n.selectable, count: n.count }));
  } catch (e) {
    console.error("[chat] professions with listings", e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * Chatdagi kasb tanlash (ega, 2026-11-22: "boshida 3 tasi ko'rinsin, «Hammasi» bosilsa hammasi, yoki qidiruvga yozsin"):
 * `q` bo'lmasa — ommabop kasblar, bo'lsa — kasblar daraxtidan qidiruv.
 */
export async function chatProfessions(input: unknown): Promise<ChatProfession[]> {
  const parsed = z.object({ mode: z.enum(["jobs", "workers"]), q: z.string().max(80).optional() }).safeParse(input);
  if (!parsed.success) return [];
  const { name } = await getT();
  const q = parsed.data.q?.trim() ?? "";
  try {
    if (q.length >= 2) {
      const hits = await searchProfessions(q, null, 12);
      return hits.map((h) => ({ id: h.id, name: name(h), selectable: h.selectable }));
    }
    return (await popular(parsed.data.mode)).map((n) => ({ id: n.id, name: name(n), selectable: n.selectable }));
  } catch (e) {
    console.error("[chat] professions", e instanceof Error ? e.message : e);
    return [];
  }
}
