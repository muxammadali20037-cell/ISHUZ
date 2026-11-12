import "server-only";
import { EMPTY_FIND, findHref } from "@/features/find/params";
import { findJobs, findWorkers, resolveFindQuery } from "@/features/find/queries";
import { createPublicClient } from "@/lib/supabase/public";
import { getRegions } from "@/lib/reference";
import { demoSamplesFor } from "@/features/demo-vacancies/samples";
import { statsSubject, summarizeSalaries, type MarketStats } from "./market-math";

export type { MarketStats };

export type MarketOutcome = { ok: true; data: MarketStats | null } | { ok: false };

/**
 * Matndan kasb va hududni tushunadi (qidiruv lug'ati bilan bir xil) va bazadan hisoblaydi. Kasb tushunilmasa — data: null
 * (yordamchi kasbni so'raydi). Soxta yoki taxminiy raqam yo'q: maosh faqat kamida 3 ta haqiqiy oylik e'londan.
 */
export async function marketStats(text: string): Promise<MarketOutcome> {
  try {
    // so'roq so'zlari olib tashlanadi ("maosh", "qancha", "talab" kasb deb tushunilmasin); qolgani — kasb va joy
    const subject = statsSubject(text.slice(0, 200));
    if (!/\p{L}{2,}/u.test(subject)) return { ok: true, data: null };
    const q = await resolveFindQuery(subject);
    if (!q.nodeId) return { ok: true, data: null };
    const db = createPublicClient();
    const region = q.regionSlug ? ((await getRegions()).find((r) => r.slug === q.regionSlug) ?? null) : null;
    const place = { regionId: region?.id ?? null, districtId: null, remote: false };
    const [node, jobs, workers, tree] = await Promise.all([
      db.from("profession_nodes").select("name_uz, name_ru, name_en, categories(slug)").eq("id", q.nodeId).maybeSingle(),
      findJobs({ ...EMPTY_FIND, mode: "jobs", p: q.nodeId }, place, 1, db),
      findWorkers({ ...EMPTY_FIND, mode: "workers", p: q.nodeId }, place, 1, db),
      db.from("profession_nodes").select("id").contains("path", [q.nodeId]).limit(500),
    ]);
    if (node.error || !node.data || !jobs.ok || !workers.ok || tree.error) return { ok: false };
    const ids = [...new Set([q.nodeId, ...(tree.data ?? []).map((r) => r.id)])];
    let salaries = db
      .from("vacancies")
      .select("salary_from, salary_to, salary_type, salary_negotiable")
      .eq("status", "active")
      .in("profession_node_id", ids)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .limit(2000);
    if (region) salaries = salaries.eq("region_id", region.id);
    const category = (node.data.categories as { slug: string } | null)?.slug ?? null;
    const [{ data: rows, error }, demos] = await Promise.all([
      salaries,
      // namunalar faqat haqiqiy e'lon yo'q bo'lsa eslatiladi va hech qachon sonlarga qo'shilmaydi
      jobs.total === 0 ? demoSamplesFor({ nodeId: q.nodeId, categorySlug: category, ids, limit: 60 }) : Promise.resolve(null),
    ]);
    if (error) return { ok: false };
    return {
      ok: true,
      data: {
        profession: { uz: node.data.name_uz, ru: node.data.name_ru, en: node.data.name_en },
        region: region ? { uz: region.name_uz, ru: region.name_ru, en: region.name_en } : null,
        vacancies: jobs.total,
        seekers: workers.total,
        salary: summarizeSalaries(rows ?? []),
        demos: demos?.exact ? demos.items.length : 0,
        jobsHref: findHref({ ...EMPTY_FIND, mode: "jobs", p: q.nodeId, region: region?.slug ?? "all" }),
        workersHref: findHref({ ...EMPTY_FIND, mode: "workers", p: q.nodeId, region: region?.slug ?? "all" }),
      },
    };
  } catch {
    return { ok: false };
  }
}
