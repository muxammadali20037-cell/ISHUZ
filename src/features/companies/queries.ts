import "server-only";

import { createClient } from "@/lib/supabase/server";

export const COMPANIES_PAGE_SIZE = 24;

export interface DirectoryCompany {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  verified: boolean;
  isGovernment: boolean;
  industryCategoryId: string | null;
  regionId: string | null;
  about: string | null;
  activeJobs: number;
}

/**
 * /companies: hozir xodim qidirayotgan kompaniyalar (0071 public_companies — faol vakansiyasi bor, bloklanmagan;
 * tasdiqlangan avval). null — bazada funksiya yo'q yoki xato (sahifa "vaqtincha ochilmadi" ko'rsatadi, soxta ro'yxat emas).
 */
export async function getDirectoryCompanies(opts: { q: string; regionId: string | null; page: number }): Promise<{ items: DirectoryCompany[]; total: number } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_companies", {
    p_query: opts.q || undefined,
    p_region_id: opts.regionId ?? undefined,
    p_limit: COMPANIES_PAGE_SIZE,
    p_offset: (opts.page - 1) * COMPANIES_PAGE_SIZE,
  });
  if (error) {
    console.error("[companies] public_companies", error.message);
    return null;
  }
  const rows = data ?? [];
  return {
    total: Number(rows[0]?.total_count ?? 0),
    items: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      logoUrl: r.logo_url,
      verified: r.verified,
      isGovernment: r.is_government,
      industryCategoryId: r.industry_category_id,
      regionId: r.region_id,
      about: r.about,
      activeJobs: Number(r.active_jobs),
    })),
  };
}
