import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCategories, getDistricts, getRegions, getSubcategoryAliases } from "@/lib/reference";
import { buildDictionary, normalizeText, type SearchDictionary, type Understood } from "./understand";

/** Kasb/joy lug'ati (sinonimlar bilan). So'rov davomida keshlanadi. */
export const getSearchDictionary = cache(async (): Promise<SearchDictionary> => {
  const [categories, regions, districts, subcategories] = await Promise.all([getCategories(), getRegions(), getDistricts(), getSubcategoryAliases()]);
  return buildDictionary({ categories, regions, districts, subcategories });
});

/**
 * Qidiruv jurnali (natijasiz qidiruvlardan sinonim/kasb qo'shish uchun). Faqat server yozadi;
 * xato bo'lsa jim o'tadi — qidiruvga ta'sir qilmaydi.
 */
export async function logSearch(input: { scope: "jobs" | "workers"; query: string; understood: Understood | null; results: number; profileId: string | null }) {
  const query = input.query.replace(/\s+/g, " ").trim().slice(0, 200);
  if (!query) return;
  try {
    const u = input.understood;
    const summary = u
      ? {
          category: u.category?.slug ?? null,
          subcategory: u.subcategory?.slug ?? null,
          region: u.region?.slug ?? null,
          districts: u.districts.map((d) => d.slug),
          salary_min: u.salaryMin,
          salary_kind: u.salaryKind,
          schedules: u.schedules,
          employment: u.employment,
          remote: u.remote,
          no_experience: u.noExperience,
          rest: u.rest || null,
        }
      : {};
    await createAdminClient()
      .from("search_logs")
      .insert({ scope: input.scope, query, query_norm: normalizeText(query).slice(0, 200) || query, understood: summary, results_count: Math.max(0, input.results), profile_id: input.profileId });
  } catch (error) {
    console.warn("[search] log", error instanceof Error ? error.message : error);
  }
}
