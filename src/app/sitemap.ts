import type { MetadataRoute } from "next";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { getServerEnv, publicEnv } from "@/lib/env";

/** Soatiga bir marta yangilanadi */
export const revalidate = 3600;

/** Har bir sahifa uchun ruscha versiya (?lang=ru) — hreflang */
function entry(base: string, path: string, e: Omit<MetadataRoute.Sitemap[number], "url">): MetadataRoute.Sitemap[number] {
  const ru = `${base}${path}${path.includes("?") ? "&" : "?"}lang=ru`;
  return { url: `${base}${path}`, ...e, alternates: { languages: { uz: `${base}${path}`, ru } } };
}

/**
 * Ommaviy sahifalar: bosh sahifa, qidiruv (hudud va kasb bo'yicha), narxlar, faol vakansiyalar va kompaniyalar.
 * Nomzodlar profillari kiritilmaydi (maxfiylik). Anonim client (cookie'siz) — RLS faqat ommaviy ma'lumot beradi.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getServerEnv().APP_URL.replace(/\/$/, "");
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    entry(base, "/", { lastModified: now, changeFrequency: "daily", priority: 1 }),
    entry(base, "/jobs", { lastModified: now, changeFrequency: "hourly", priority: 0.9 }),
    entry(base, "/pricing", { lastModified: now, changeFrequency: "monthly", priority: 0.3 }),
    entry(base, "/privacy", { lastModified: now, changeFrequency: "yearly", priority: 0.1 }),
  ];
  try {
    const supabase = createSupabaseClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const [vacancies, companies, categories, regions] = await Promise.all([
      supabase.from("vacancies").select("slug, updated_at, company_id").eq("status", "active").order("published_at", { ascending: false }).limit(20000),
      supabase.from("companies").select("slug, updated_at").eq("is_blocked", false).not("slug", "is", null).limit(10000),
      supabase.from("categories").select("slug").eq("is_active", true).order("sort_order"),
      supabase.from("regions").select("slug").eq("is_active", true).order("sort_order"),
    ]);
    // "Toshkentda ish", "haydovchi ishi" kabi qidiruvlar uchun: hudud va kasb sahifalari
    const listing = [
      ...(categories.data ?? []).map((c) => `/jobs?category=${c.slug}`),
      ...(regions.data ?? []).map((r) => `/jobs?region=${r.slug}`),
    ].map((path) => entry(base, path, { lastModified: now, changeFrequency: "daily", priority: 0.7 }));
    const withJobs = new Set((vacancies.data ?? []).map((v) => v.company_id).filter(Boolean));
    return [
      ...staticPages,
      ...listing,
      ...(vacancies.data ?? []).map((v) => entry(base, `/jobs/${v.slug}`, { lastModified: new Date(v.updated_at), changeFrequency: "daily", priority: 0.8 })),
      ...(companies.data ?? [])
        .filter((c) => c.slug)
        .map((c) => entry(base, `/company/${c.slug}`, { lastModified: new Date(c.updated_at), changeFrequency: "weekly", priority: withJobs.size ? 0.5 : 0.4 })),
    ];
  } catch (error) {
    console.error("[sitemap]", error instanceof Error ? error.message : error);
    return staticPages;
  }
}
