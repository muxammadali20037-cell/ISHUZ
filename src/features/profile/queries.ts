import "server-only";

import { cache } from "react";
import { createClient, type SupabaseServerClient } from "@/lib/supabase/server";
import { getBenefits, getCategories, getDistricts, getLanguages, getRegions, getSkills, getSubcategories } from "@/lib/reference";
import { parseEmployerStats, suggestionLinks } from "./pure";

/** Storage public URL (avatars / portfolio bucket'lari ochiq) */
export function publicMediaUrl(supabase: SupabaseServerClient, bucket: "avatars" | "portfolio", path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

const WORKER_SELECT =
  "*, category:categories(id, slug, name_uz, name_ru, icon, portfolio_recommended), subcategory:subcategories(id, slug, name_uz, name_ru), region:regions(id, slug, name_uz, name_ru), district:districts!worker_profiles_district_id_fkey(id, slug, name_uz, name_ru)" as const;

/**
 * Ish qidiruvchi profilining to'liq ko'rinishi (faqat egasi uchun chaqiriladi; RLS egasiga hammasini ochadi).
 */
export const getWorkerProfileFull = cache(async (workerId: string) => {
  const supabase = await createClient();
  const [worker, locations, preferences, skills, languages, experience, education, portfolio, geo] = await Promise.all([
    supabase.from("worker_profiles").select(WORKER_SELECT).eq("id", workerId).maybeSingle(),
    supabase.from("worker_locations").select("district_id, district:districts(id, region_id, slug, name_uz, name_ru)").eq("worker_id", workerId),
    supabase.from("worker_preferences").select("*").eq("worker_id", workerId).maybeSingle(),
    supabase.from("worker_skills").select("skill_id, level, skill:skills(id, slug, name_uz, name_ru, is_approved, is_custom)").eq("worker_id", workerId),
    supabase.from("worker_languages").select("language_code, level, language:languages(code, name_uz, name_ru)").eq("worker_id", workerId),
    supabase.from("worker_experience").select("*").eq("worker_id", workerId).order("is_current", { ascending: false }).order("started_on", { ascending: false }),
    supabase.from("worker_education").select("*").eq("worker_id", workerId).order("ended_year", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
    supabase.from("worker_portfolio").select("*").eq("worker_id", workerId).order("sort_order").order("created_at"),
    supabase.from("worker_geo").select("lat, lng").eq("worker_id", workerId).maybeSingle(),
  ]);
  if (!worker.data) return null;
  return {
    worker: worker.data,
    locations: locations.data ?? [],
    preferences: preferences.data,
    skills: skills.data ?? [],
    languages: languages.data ?? [],
    experience: experience.data ?? [],
    education: education.data ?? [],
    portfolio: (portfolio.data ?? []).map((item) => ({
      ...item,
      media: item.media_paths.map((path) => ({ path, url: publicMediaUrl(supabase, "portfolio", path) })),
    })),
    geo: geo.data,
  };
});

export type WorkerProfileFull = NonNullable<Awaited<ReturnType<typeof getWorkerProfileFull>>>;
export type WorkerExperienceRow = WorkerProfileFull["experience"][number];
export type WorkerEducationRow = WorkerProfileFull["education"][number];
export type WorkerPortfolioItem = WorkerProfileFull["portfolio"][number];
export type WorkerSkillRow = WorkerProfileFull["skills"][number];
export type WorkerLanguageRow = WorkerProfileFull["languages"][number];
export type WorkerLocationRow = WorkerProfileFull["locations"][number];

/** worker_completeness RPC → ball + havolali tavsiyalar */
export const getCompleteness = cache(async (workerId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("worker_completeness", { p_worker_id: workerId }).maybeSingle();
  return { score: data?.score ?? 0, suggestions: suggestionLinks(data?.suggestions ?? []) };
});

/** profile_rating RPC + men haqimdagi tasdiqlangan sharhlar */
export const getMyRating = cache(async (profileId: string) => {
  const supabase = await createClient();
  const [rating, reviews] = await Promise.all([
    supabase.rpc("profile_rating", { p_profile_id: profileId }).maybeSingle(),
    supabase
      .from("reviews")
      .select("id, rating, text, created_at, author:profiles!reviews_author_profile_id_fkey(id, first_name, last_name, avatar_url)")
      .eq("target_profile_id", profileId)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  return {
    avg: rating.data?.avg_rating != null ? Number(rating.data.avg_rating) : null,
    count: Number(rating.data?.reviews_count ?? 0),
    reviews: reviews.data ?? [],
  };
});

export type MyRating = Awaited<ReturnType<typeof getMyRating>>;

/** Kontakt sozlamalari (faqat egasi o'qiy oladi) */
export const getMyContacts = cache(async (profileId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("profile_contacts").select("phone, phone_verified_at, email, telegram_username, phone_visibility").eq("profile_id", profileId).maybeSingle();
  return data;
});

export const getMyTelegram = cache(async (profileId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("telegram_accounts").select("username, first_name, linked_at, bot_started").eq("profile_id", profileId).maybeSingle();
  return data;
});

export const getMyContactGrants = cache(async (profileId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contact_grants")
    .select("grantee_profile_id, created_at, grantee:profiles!contact_grants_grantee_profile_id_fkey(id, first_name, last_name, avatar_url)")
    .eq("owner_profile_id", profileId)
    .order("created_at", { ascending: false });
  return data ?? [];
});

export type ContactGrantRow = Awaited<ReturnType<typeof getMyContactGrants>>[number];

/** Ish beruvchi profili qisqacha (faqat employer roli bo'lganlar uchun /profile) */
export const getEmployerSummary = cache(async (profileId: string) => {
  const supabase = await createClient();
  const [employer, stats] = await Promise.all([
    supabase
      .from("employer_profiles")
      .select("*, company:companies(id, name, slug, logo_url, verification_status), region:regions(id, name_uz, name_ru), district:districts(id, name_uz, name_ru)")
      .eq("profile_id", profileId)
      .maybeSingle(),
    supabase.rpc("employer_dashboard_stats"),
  ]);
  if (!employer.data) return null;
  return { employer: employer.data, stats: parseEmployerStats(stats.data) };
});

/** Tahrirlash sahifasi uchun ma'lumotnoma + kategoriyaga mos ko'nikmalar */
export const getEditReferenceData = cache(async (categoryId: string | null) => {
  const [categories, subcategories, regions, districts, languages, officialTerms, suggestedSkills] = await Promise.all([
    getCategories(),
    getSubcategories(),
    getRegions(),
    getDistricts(),
    getLanguages(),
    getBenefits("official_term"),
    getSkills(categoryId ?? undefined),
  ]);
  return { categories, subcategories, regions, districts, languages, officialTerms, suggestedSkills };
});

export type EditReferenceData = Awaited<ReturnType<typeof getEditReferenceData>>;

