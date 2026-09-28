import type { MetadataRoute } from "next";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { getServerEnv, publicEnv } from "@/lib/env";

/** Soatiga bir marta yangilanadi */
export const revalidate = 3600;

/**
 * Ommaviy sahifalar: bosh sahifa, qidiruv, narxlar, faol vakansiyalar va kompaniyalar.
 * Nomzodlar profillari kiritilmaydi (maxfiylik). Anonim client (cookie'siz) — RLS faqat ommaviy ma'lumot beradi.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getServerEnv().APP_URL.replace(/\/$/, "");
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/jobs`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];
  try {
    const supabase = createSupabaseClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const [vacancies, companies] = await Promise.all([
      supabase.from("vacancies").select("slug, updated_at, company_id").eq("status", "active").order("published_at", { ascending: false }).limit(20000),
      supabase.from("companies").select("slug, updated_at").eq("is_blocked", false).not("slug", "is", null).limit(10000),
    ]);
    const withJobs = new Set((vacancies.data ?? []).map((v) => v.company_id).filter(Boolean));
    return [
      ...staticPages,
      ...(vacancies.data ?? []).map((v) => ({ url: `${base}/jobs/${v.slug}`, lastModified: new Date(v.updated_at), changeFrequency: "daily" as const, priority: 0.8 })),
      ...(companies.data ?? [])
        .filter((c) => c.slug)
        .map((c) => ({ url: `${base}/company/${c.slug}`, lastModified: new Date(c.updated_at), changeFrequency: "weekly" as const, priority: withJobs.size ? 0.5 : 0.4 })),
    ];
  } catch (error) {
    console.error("[sitemap]", error instanceof Error ? error.message : error);
    return staticPages;
  }
}
