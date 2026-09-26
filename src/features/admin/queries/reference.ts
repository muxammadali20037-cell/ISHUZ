import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";
import { PAGE_SIZE, likeTerm, isUuid, oneOf, pageRange, parsePage, param, toPaged, type Paged, type SearchParams } from "./shared";

export type CategoryRow = Tables<"categories"> & { subcategories: Tables<"subcategories">[] };

/** Barcha kategoriyalar (nofaollar ham) + subkategoriyalar */
export async function listCategoriesWithSubs(): Promise<{ rows: CategoryRow[]; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").select("*, subcategories(*)").order("sort_order").order("sort_order", { referencedTable: "subcategories" });
  return { rows: (data ?? []) as CategoryRow[], error: error?.message ?? null };
}

/** Filtrlar uchun qisqa ro'yxat */
export async function categoryOptions() {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, name_uz, name_ru").order("sort_order");
  return data ?? [];
}

export async function regionOptions() {
  const supabase = await createClient();
  const { data } = await supabase.from("regions").select("id, name_uz, name_ru").order("sort_order");
  return data ?? [];
}

// ---------- skills ----------
export interface SkillFilters {
  q: string;
  custom: "yes" | "no" | undefined;
  approved: "yes" | "no" | undefined;
  category: string;
  page: number;
}

export function parseSkillFilters(sp: SearchParams): SkillFilters {
  const category = param(sp, "category");
  return {
    q: param(sp, "q"),
    custom: oneOf(param(sp, "custom"), ["yes", "no"] as const),
    approved: oneOf(param(sp, "approved"), ["yes", "no"] as const),
    category: isUuid(category) ? category : "",
    page: parsePage(sp),
  };
}

export type SkillRow = Tables<"skills"> & { categories: { name_uz: string; name_ru: string } | null; profiles: { first_name: string; last_name: string } | null };

export async function listSkills(f: SkillFilters): Promise<Paged<SkillRow> & { error: string | null; pendingCount: number }> {
  const supabase = await createClient();
  const [from, to] = pageRange(f.page);
  let q = supabase
    .from("skills")
    .select("*, categories(name_uz, name_ru), profiles(first_name, last_name)", { count: "exact" })
    .order("is_approved", { ascending: true })
    .order("usage_count", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (f.custom) q = q.eq("is_custom", f.custom === "yes");
  if (f.approved) q = q.eq("is_approved", f.approved === "yes");
  if (f.category) q = q.eq("category_id", f.category);
  if (f.q) q = q.or(`name_uz.ilike.${likeTerm(f.q)},name_ru.ilike.${likeTerm(f.q)},slug.ilike.${likeTerm(f.q)}`);
  const [{ data, count, error }, pending] = await Promise.all([q, supabase.from("skills").select("id", { count: "exact", head: true }).eq("is_approved", false)]);
  return { ...toPaged<SkillRow>(data ?? [], count, f.page, PAGE_SIZE), error: error?.message ?? null, pendingCount: pending.count ?? 0 };
}

// ---------- regions ----------
export type RegionRow = Tables<"regions"> & { districts: Tables<"districts">[] };

export async function listRegionsWithDistricts(): Promise<{ rows: RegionRow[]; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("regions").select("*, districts(*)").order("sort_order").order("sort_order", { referencedTable: "districts" });
  return { rows: (data ?? []) as RegionRow[], error: error?.message ?? null };
}
