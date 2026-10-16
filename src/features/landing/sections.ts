import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

/** Ish e'lonlari bo'limlari (0066 vacancy_section_counts): hududda faol, muddati o'tmaganlar; masofaviy — hududdan qat'i nazar */
export interface JobSections {
  total: number;
  today: number;
  daily: number;
  remote: number;
  noexp: number;
  company: number;
  ie: number;
  person: number;
  gov: number;
  top: number;
  mass: number;
}

/** Ishchilar bo'limlari (0066 worker_section_counts) */
export interface WorkerSections {
  total: number;
  daily: number;
  experienced: number;
  remote: number;
}

const n = (v: number | string | null | undefined) => Number(v ?? 0);
const NO_FUNCTION = new Set(["PGRST202", "42883"]);
let warnedMissing = false;

/** 0066 hali qo'llanmagan bo'lsa — bir marta ogohlantirish (har so'rovda log to'lmasin) */
function fail(scope: string, error: { code?: string; message: string }): never {
  if (NO_FUNCTION.has(error.code ?? "")) {
    if (!warnedMissing) console.warn(`[sections] ${scope}: 0066 qo'llanmagan — bo'lim sonlari ko'rsatilmaydi`);
    warnedMissing = true;
  } else console.warn(`[sections] ${scope}`, error.code, error.message);
  throw new Error(`sections_${scope}`);
}

async function loadJobs(regionId: string | null, districtId: string | null): Promise<JobSections> {
  const { data, error } = await createPublicClient().rpc("vacancy_section_counts", { p_region_id: regionId ?? undefined, p_district_id: districtId ?? undefined });
  if (error) fail("jobs", error);
  const r = data?.[0];
  if (!r) throw new Error("sections_jobs_empty");
  return {
    total: n(r.total),
    today: n(r.today),
    daily: n(r.daily),
    remote: n(r.remote),
    noexp: n(r.no_experience),
    company: n(r.company),
    ie: n(r.entrepreneur),
    person: n(r.person),
    gov: n(r.government),
    top: n(r.featured),
    mass: n(r.mass),
  };
}

async function loadWorkers(regionId: string | null, districtId: string | null): Promise<WorkerSections> {
  const { data, error } = await createPublicClient().rpc("worker_section_counts", { p_region_id: regionId ?? undefined, p_district_id: districtId ?? undefined });
  if (error) fail("workers", error);
  const r = data?.[0];
  if (!r) throw new Error("sections_workers_empty");
  return { total: n(r.total), daily: n(r.daily), experienced: n(r.experienced), remote: n(r.remote) };
}

// bozor paneli bilan bir xil kesh qoidasi (hudud bo'yicha alohida): MARKET_CACHE_SECONDS=0 — keshsiz (E2E stend)
const TTL = Number(process.env.MARKET_CACHE_SECONDS ?? 600);
const cachedJobs = unstable_cache(loadJobs, ["home-job-sections-v1"], { revalidate: TTL > 0 ? TTL : 600, tags: ["market"] });
const cachedWorkers = unstable_cache(loadWorkers, ["home-worker-sections-v1"], { revalidate: TTL > 0 ? TTL : 600, tags: ["market"] });

/** Xato yoki 0066 yo'q — null: sonlar ko'rsatilmaydi, faqat 0066'siz ishlaydigan bo'limlar qoladi (soxta raqam yo'q) */
export const getJobSections = cache(async (regionId: string | null, districtId: string | null): Promise<JobSections | null> => {
  try {
    return TTL > 0 ? await cachedJobs(regionId, districtId) : await loadJobs(regionId, districtId);
  } catch {
    return null;
  }
});

export const getWorkerSections = cache(async (regionId: string | null, districtId: string | null): Promise<WorkerSections | null> => {
  try {
    return TTL > 0 ? await cachedWorkers(regionId, districtId) : await loadWorkers(regionId, districtId);
  } catch {
    return null;
  }
});
