import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createPublicClient, REFERENCE_CACHE } from "@/lib/supabase/public";
import type { Tables } from "@/types/database.types";

export type Category = Pick<Tables<"categories">, "id" | "slug" | "name_uz" | "name_ru" | "name_en" | "icon" | "sort_order" | "portfolio_recommended">;
export type Subcategory = Pick<Tables<"subcategories">, "id" | "category_id" | "slug" | "name_uz" | "name_ru" | "sort_order">;
export type Region = Pick<Tables<"regions">, "id" | "slug" | "name_uz" | "name_ru" | "name_en" | "name_oz" | "sort_order">;
export type District = Pick<Tables<"districts">, "id" | "region_id" | "slug" | "name_uz" | "name_ru" | "name_oz" | "kind" | "lat" | "lng" | "sort_order">;
export type Skill = Pick<Tables<"skills">, "id" | "slug" | "name_uz" | "name_ru" | "category_id" | "usage_count">;
export type Language = Pick<Tables<"languages">, "code" | "name_uz" | "name_ru" | "sort_order">;
export type Benefit = Pick<Tables<"benefits">, "code" | "name_uz" | "name_ru" | "kind" | "sort_order">;

/**
 * Ma'lumotnoma jadvallari (kategoriya, hudud, ko'nikma ...). Hammasi ochiq va kam o'zgaradi:
 * so'rovlar ORASIDA keshlanadi (unstable_cache, 1 soat, tag "reference" — admin o'zgartirsa darhol yangilanadi)
 * va bir so'rov ichida takrorlanmaydi (React cache). Har sahifada bazaga qayta so'rov ketmaydi.
 */
/**
 * Kesh: so'rovlar orasida (unstable_cache) + so'rov ichida (React cache). Xato keshlanmaydi —
 * shu so'rov uchun bo'sh ro'yxat qaytadi, keyingisi bazadan qayta o'qiydi.
 */
function cachedRef<A extends unknown[], T>(key: string, load: (supabase: ReturnType<typeof createPublicClient>, ...args: A) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const cached = unstable_cache(
    async (...args: A): Promise<T[]> => {
      const { data, error } = await load(createPublicClient(), ...args);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    [`ref:${key}`],
    REFERENCE_CACHE,
  );
  return cache(async (...args: A): Promise<T[]> => {
    try {
      return await cached(...args);
    } catch (e) {
      console.error(`[reference] ${key}`, e instanceof Error ? e.message : e);
      return [];
    }
  });
}

export const getCategories = cachedRef<[], Category>("categories", (db) =>
  db.from("categories").select("id, slug, name_uz, name_ru, name_en, icon, sort_order, portfolio_recommended").eq("is_active", true).order("sort_order"),
);

export const getSubcategories = cachedRef<[categoryId?: string], Subcategory>("subcategories", (db, categoryId) => {
  let q = db.from("subcategories").select("id, category_id, slug, name_uz, name_ru, sort_order").eq("is_active", true).order("sort_order");
  if (categoryId) q = q.eq("category_id", categoryId);
  return q;
});

export const getRegions = cachedRef<[], Region>("regions", (db) =>
  db.from("regions").select("id, slug, name_uz, name_ru, name_en, name_oz, sort_order").eq("is_active", true).order("sort_order"),
);

export const getDistricts = cachedRef<[regionId?: string], District>("districts", (db, regionId) => {
  let q = db.from("districts").select("id, region_id, slug, name_uz, name_ru, name_oz, kind, lat, lng, sort_order").eq("is_active", true).order("sort_order");
  if (regionId) q = q.eq("region_id", regionId);
  return q;
});

export const getSkills = cachedRef<[categoryId?: string], Skill>("skills", (db, categoryId) => {
  let q = db.from("skills").select("id, slug, name_uz, name_ru, category_id, usage_count").eq("is_approved", true).order("usage_count", { ascending: false }).limit(300);
  if (categoryId) q = q.or(`category_id.eq.${categoryId},category_id.is.null`);
  return q;
});

export const getLanguages = cachedRef<[], Language>("languages", (db) =>
  db.from("languages").select("code, name_uz, name_ru, sort_order").eq("is_active", true).order("sort_order"),
);

export const getBenefits = cachedRef<[kind?: "benefit" | "official_term"], Benefit>("benefits", (db, kind) => {
  let q = db.from("benefits").select("code, name_uz, name_ru, kind, sort_order").eq("is_active", true).order("sort_order");
  if (kind) q = q.eq("kind", kind);
  return q;
});

/** Qidiruv lug'ati uchun yo'nalishlar sinonimlari bilan */
export const getSubcategoryAliases = cachedRef<[], Pick<Tables<"subcategories">, "id" | "slug" | "name_uz" | "name_ru" | "category_id" | "aliases">>("subcategory_aliases", (db) =>
  db.from("subcategories").select("id, slug, name_uz, name_ru, category_id, aliases").eq("is_active", true).order("sort_order"),
);

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
