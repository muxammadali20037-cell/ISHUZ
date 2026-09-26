import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

export type Category = Pick<Tables<"categories">, "id" | "slug" | "name_uz" | "name_ru" | "icon" | "sort_order" | "portfolio_recommended">;
export type Subcategory = Pick<Tables<"subcategories">, "id" | "category_id" | "slug" | "name_uz" | "name_ru" | "sort_order">;
export type Region = Pick<Tables<"regions">, "id" | "slug" | "name_uz" | "name_ru" | "sort_order">;
export type District = Pick<Tables<"districts">, "id" | "region_id" | "slug" | "name_uz" | "name_ru" | "lat" | "lng" | "sort_order">;
export type Skill = Pick<Tables<"skills">, "id" | "slug" | "name_uz" | "name_ru" | "category_id" | "usage_count">;
export type Language = Pick<Tables<"languages">, "code" | "name_uz" | "name_ru" | "sort_order">;
export type Benefit = Pick<Tables<"benefits">, "code" | "name_uz" | "name_ru" | "kind" | "sort_order">;

/**
 * Ma'lumotnoma jadvallari (kategoriya, hudud, ko'nikma ...). So'rov davomida keshlanadi (React cache).
 * Hammasi public read; o'zgarishi kam.
 */
export const getCategories = cache(async (): Promise<Category[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, slug, name_uz, name_ru, icon, sort_order, portfolio_recommended").eq("is_active", true).order("sort_order");
  return data ?? [];
});

export const getSubcategories = cache(async (categoryId?: string): Promise<Subcategory[]> => {
  const supabase = await createClient();
  let q = supabase.from("subcategories").select("id, category_id, slug, name_uz, name_ru, sort_order").eq("is_active", true).order("sort_order");
  if (categoryId) q = q.eq("category_id", categoryId);
  const { data } = await q;
  return data ?? [];
});

export const getRegions = cache(async (): Promise<Region[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("regions").select("id, slug, name_uz, name_ru, sort_order").eq("is_active", true).order("sort_order");
  return data ?? [];
});

export const getDistricts = cache(async (regionId?: string): Promise<District[]> => {
  const supabase = await createClient();
  let q = supabase.from("districts").select("id, region_id, slug, name_uz, name_ru, lat, lng, sort_order").eq("is_active", true).order("sort_order");
  if (regionId) q = q.eq("region_id", regionId);
  const { data } = await q;
  return data ?? [];
});

export const getSkills = cache(async (categoryId?: string): Promise<Skill[]> => {
  const supabase = await createClient();
  let q = supabase.from("skills").select("id, slug, name_uz, name_ru, category_id, usage_count").eq("is_approved", true).order("usage_count", { ascending: false }).limit(300);
  if (categoryId) q = q.or(`category_id.eq.${categoryId},category_id.is.null`);
  const { data } = await q;
  return data ?? [];
});

export const getLanguages = cache(async (): Promise<Language[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("languages").select("code, name_uz, name_ru, sort_order").eq("is_active", true).order("sort_order");
  return data ?? [];
});

export const getBenefits = cache(async (kind?: "benefit" | "official_term"): Promise<Benefit[]> => {
  const supabase = await createClient();
  let q = supabase.from("benefits").select("code, name_uz, name_ru, kind, sort_order").eq("is_active", true).order("sort_order");
  if (kind) q = q.eq("kind", kind);
  const { data } = await q;
  return data ?? [];
});

/** Kategoriya slug → yozuv */
export const getCategoryBySlug = cache(async (slug: string): Promise<Category | null> => {
  const list = await getCategories();
  return list.find((c) => c.slug === slug) ?? null;
});

/** Barcha ma'lumotnomani bitta obyektda (wizard'lar uchun) */
export const getReferenceData = cache(async () => {
  const [categories, subcategories, regions, districts, languages, benefits] = await Promise.all([
    getCategories(),
    getSubcategories(),
    getRegions(),
    getDistricts(),
    getLanguages(),
    getBenefits(),
  ]);
  return { categories, subcategories, regions, districts, languages, benefits };
});

export type ReferenceData = Awaited<ReturnType<typeof getReferenceData>>;
