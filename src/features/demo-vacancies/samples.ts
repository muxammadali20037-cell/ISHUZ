import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { getDemoVacancies } from "./queries";
import type { DemoSamples } from "./types";

/** Kasb va uning ichidagi kasblar (profession_nodes.path shu kasbni o'z ichiga oladi) */
export async function professionSubtree(nodeId: string): Promise<string[] | null> {
  const { data, error } = await createPublicClient().from("profession_nodes").select("id").contains("path", [nodeId]).limit(500);
  if (error) return null;
  return [...new Set([nodeId, ...(data ?? []).map((r) => r.id)])];
}

/**
 * Haqiqiy e'lon topilmadi — shu kasb bo'yicha namuna e'lonlar (bo'lmasa shu sohadagi namunalar). Namunalar o'chirilgan yoki
 * 0077 hali qo'llanmagan bo'lsa — null (hech narsa ko'rsatilmaydi). Xato hech qachon qidiruvni buzmaydi.
 */
export async function demoSamplesFor(input: { nodeId: string; categorySlug: string | null; region?: string | null; ids?: string[] | null; limit?: number }): Promise<DemoSamples | null> {
  if (!input.categorySlug) return null;
  try {
    const [list, ids] = await Promise.all([
      getDemoVacancies({ category: input.categorySlug, region: input.region && input.region !== "all" ? input.region : null, limit: 60 }),
      input.ids ? Promise.resolve(input.ids) : professionSubtree(input.nodeId),
    ]);
    if (!list.items.length) return null;
    const own = new Set(ids ?? [input.nodeId]);
    const exact = list.items.filter((d) => !!d.profession_node_id && own.has(d.profession_node_id));
    const items = (exact.length ? exact : list.items).slice(0, input.limit ?? 3);
    return { items, exact: exact.length > 0, href: `/jobs/namuna?${new URLSearchParams({ soha: input.categorySlug })}` };
  } catch {
    return null;
  }
}
