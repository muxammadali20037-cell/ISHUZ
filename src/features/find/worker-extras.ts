import "server-only";

import { getCategories } from "@/lib/reference";
import { createPublicClient } from "@/lib/supabase/public";
import { workerExtraKeysFor, type WorkerExtraKey } from "@/features/post/requirements";

/**
 * Kasb id → shu kasbga xos ishchi savollari (ega, 2026-11-24: haydovchi — guvohnoma va mashina, kuryer — transport, usta —
 * asboblar). Soha (kategoriya) faqat serverda ma'lum — shu yerda aniqlanadi va kasb tanlovlariga qo'shib yuboriladi.
 */
export async function workerExtraKeysById(ids: readonly string[]): Promise<Map<string, WorkerExtraKey[]>> {
  const out = new Map<string, WorkerExtraKey[]>();
  const uniq = [...new Set(ids)].filter(Boolean);
  if (!uniq.length) return out;
  const [cats, { data }] = await Promise.all([getCategories(), createPublicClient().from("profession_nodes").select("id, category_id, name_uz, name_ru, name_en").in("id", uniq)]);
  const slug = new Map(cats.map((c) => [c.id, c.slug]));
  for (const n of data ?? []) {
    const keys = workerExtraKeysFor({ category: slug.get(n.category_id) ?? null, names: [n.name_uz, n.name_ru, n.name_en ?? ""] });
    if (keys.length) out.set(n.id, keys);
  }
  return out;
}

/** Kasb tanlovlariga savollar ro'yxati qo'shiladi (savoli yo'q kasbga — hech narsa) */
export async function withWorkerExtraKeys<T extends { id: string }>(items: T[]): Promise<(T & { extraKeys?: WorkerExtraKey[] })[]> {
  try {
    const keys = await workerExtraKeysById(items.map((i) => i.id));
    return items.map((i) => (keys.has(i.id) ? { ...i, extraKeys: keys.get(i.id)! } : i));
  } catch {
    // savollar — qo'shimcha; xato bo'lsa e'lon savolsiz davom etadi
    return items;
  }
}
