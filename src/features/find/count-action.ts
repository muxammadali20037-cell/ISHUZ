"use server";

import { getDistricts, getRegions } from "@/lib/reference";
import { anyProfession, parseFindParams } from "./params";
import { findJobs, findWorkers } from "./queries";

/**
 * Filtr oynasi uchun: tanlangan filtrlar bilan nechta natija chiqishi ("Natijalarni ko'rish (N)") — sahifadagi qidiruv bilan
 * aynan bir xil funksiya va hudud qoidasi (taxmin emas). Aniqlab bo'lmaydigan holat (matnli qidiruv, kasb hali tanlanmagan,
 * noma'lum hudud, texnik xato) — { ok: false }: tugmada son ko'rsatilmaydi.
 */
export async function countFindResults(query: string): Promise<{ ok: true; total: number } | { ok: false }> {
  if (typeof query !== "string" || query.length > 1000) return { ok: false };
  const params = { ...parseFindParams(Object.fromEntries(new URLSearchParams(query))), page: 1 };
  if (!params.mode || (params.q && !params.p) || (!params.p && !anyProfession(params))) return { ok: false };
  const [regions, districts] = await Promise.all([getRegions(), getDistricts()]);
  const named = params.region && params.region !== "all" && params.region !== "remote";
  const region = named ? (regions.find((r) => r.slug === params.region) ?? null) : null;
  if (named && !region) return { ok: false };
  const district = region && params.district && params.district !== "all" ? (districts.find((d) => d.id === params.district && d.region_id === region.id) ?? null) : null;
  const place = { regionId: region?.id ?? null, districtId: district?.id ?? null, remote: params.region === "remote" };
  const res = params.mode === "jobs" ? await findJobs(params, place, 1) : await findWorkers(params, place, 1);
  return res.ok ? { ok: true, total: res.total } : { ok: false };
}
