import "server-only";
import { findJobs } from "@/features/find/queries";
import { EMPTY_FIND } from "@/features/find/params";
import { createPublicClient } from "@/lib/supabase/public";
import type { District, Region } from "@/lib/reference";
import type { JobCardData } from "@/features/find/components/result-cards";
import { getDemoVacancies } from "@/features/demo-vacancies/queries";
import type { DemoVacancy } from "@/features/demo-vacancies/types";
import { MAX_PINS, centroid, distanceKm, type LatLng } from "./geo";

/** Xaritadagi bitta haqiqiy e'lon: karta ma'lumoti + nuqta (aniq manzil yoki tuman markazi) + masofa */
export interface MapJob {
  job: JobCardData;
  point: LatLng | null;
  /** ish beruvchi aniq nuqta ko'rsatgan (vakansiya.lat/lng); aks holda — tuman markazi (taxminiy) */
  exact: boolean;
  km: number | null;
}

export interface MapDemo {
  job: DemoVacancy;
  point: LatLng;
  km: number | null;
}

export type MapJobsResult =
  | { ok: true; center: LatLng | null; jobs: MapJob[]; total: number; demo: MapDemo[] }
  | { ok: false; errorId: string };

const LIST_LIMIT = 60;

/** Tanlangan joy markazi: tuman (koordinatasi bo'lsa) yoki viloyatdagi tumanlar o'rtasi */
export function placeCenter(region: Region | null, district: District | null, districts: District[]): LatLng | null {
  if (district?.lat != null && district.lng != null) return { lat: district.lat, lng: district.lng };
  if (!region) return null;
  return centroid(districts.filter((d) => d.region_id === region.id && d.lat != null && d.lng != null).map((d) => ({ lat: d.lat!, lng: d.lng! })));
}

/**
 * Viloyatdagi faol vakansiyalar (ommaviy qidiruv funksiyasi orqali — ko'rinish qoidalari o'sha: moderatsiya, muddat, bloklar),
 * har biriga nuqta: ish beruvchi ko'rsatgan aniq joy yoki tuman markazi. Tanlangan joydan masofa bo'yicha saralanadi.
 * Haqiqiy e'lon bo'lmasa — o'sha viloyatdagi namuna e'lonlar (alohida, "Namuna" belgisi bilan).
 * Foydalanuvchi koordinatasi serverga yuborilmaydi: brauzer eng yaqin tumanni o'zi topadi (locate-ask), bu yerga faqat tuman keladi.
 */
export async function getMapJobs(region: Region, district: District | null, districts: District[]): Promise<MapJobsResult> {
  const center = placeCenter(region, district, districts);
  const res = await findJobs({ ...EMPTY_FIND, mode: "jobs", any: true }, { regionId: region.id, districtId: null, remote: false }, LIST_LIMIT, createPublicClient());
  if (!res.ok) return res;
  const rows = res.items as unknown as JobCardData[];
  const byId = new Map(districts.map((d) => [d.id, d]));
  let coords = new Map<string, { lat: number | null; lng: number | null; district_id: string | null }>();
  if (rows.length) {
    const { data, error } = await createPublicClient().from("vacancies").select("id, lat, lng, district_id").in("id", rows.map((r) => r.id));
    if (error) return { ok: false, errorId: `coords_${error.code ?? "x"}` };
    coords = new Map((data ?? []).map((r) => [r.id, r]));
  }
  const jobs: MapJob[] = rows.map((job) => {
    const c = coords.get(job.id);
    const d = c?.district_id ? byId.get(c.district_id) : null;
    const point = c?.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : d?.lat != null && d.lng != null ? { lat: d.lat, lng: d.lng } : null;
    return { job, point, exact: c?.lat != null && c.lng != null, km: point && center ? distanceKm(center, point) : null };
  });
  // avval nuqtasi borlar (yaqinidan uzog'iga), keyin joyi noma'lumlar (yangisi birinchi — qidiruv tartibi)
  jobs.sort((a, b) => (a.km == null ? 1 : 0) - (b.km == null ? 1 : 0) || (a.km ?? 0) - (b.km ?? 0));

  let demo: MapDemo[] = [];
  if (!jobs.length) {
    const list = await getDemoVacancies({ region: region.slug, limit: 40 });
    demo = list.items
      .filter((v) => v.region_name_uz === region.name_uz && v.lat != null && v.lng != null)
      .map((v) => ({ job: v, point: { lat: v.lat!, lng: v.lng! }, km: center ? distanceKm(center, { lat: v.lat!, lng: v.lng! }) : null }))
      .sort((a, b) => (a.km ?? 0) - (b.km ?? 0))
      .slice(0, MAX_PINS);
  }
  return { ok: true, center, jobs, total: res.total, demo };
}
