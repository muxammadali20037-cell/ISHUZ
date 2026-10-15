import "server-only";

import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { getDistricts, getRegions, type District, type Region } from "@/lib/reference";
import type { SessionContext } from "@/features/auth/session";
import { EMPTY_FIND, findHref } from "@/features/find/params";
import { PLACE_COOKIE, parsePlace } from "@/features/find/place";
import { findJobs, findWorkers, type JobRow, type WorkerRow } from "@/features/find/queries";

/** Bosh sahifadagi ro'yxat hajmi: telefonda 3–4 ta ekranga sig'adi, qolgani — "Barcha vakansiyalar" */
export const HOME_LIST = 8;

export interface HomePlace {
  region: Region | null;
  district: District | null;
}

/** Shu qurilmada eslab qolingan hudud ("Yaqin atrofda" aniqlagan) — yo'q bo'lsa butun O'zbekiston */
export async function getHomePlace(): Promise<HomePlace> {
  const place = parsePlace((await cookies()).get(PLACE_COOKIE)?.value);
  if (!place) return { region: null, district: null };
  const [regions, districts] = await Promise.all([getRegions(), getDistricts()]);
  const region = regions.find((r) => r.slug === place.region) ?? null;
  const district = region && place.district !== "all" ? (districts.find((d) => d.id === place.district && d.region_id === region.id) ?? null) : null;
  return { region, district };
}

type Named = { name_uz: string; name_ru: string; name_en: string | null };

export interface JobFeed {
  ok: true;
  /** "match" — ish qidiruvchi profilidagi kasb (va hudud) bo'yicha; "new" — eng yangi e'lonlar */
  kind: "match" | "new";
  items: JobRow[];
  total: number;
  images: Record<string, string>;
  photos: Record<string, string>;
  /** "Sizga mos": qaysi kasb va hudud bo'yicha tanlangani (ekranda sabab sifatida yoziladi) */
  profession: Named | null;
  region: Region | null;
  district: District | null;
  /** profilda kasb bor, lekin unga e'lon topilmadi — "Yangi ishlar" ko'rsatildi */
  noMatchFor: Named | null;
  allHref: string;
}

export type FeedResult<T> = T | { ok: false; errorId: string };

/** Profil yetarlimi: kasb tanlangan bo'lsa — "Sizga mos ishlar" shu kasb va viloyat bo'yicha */
async function workerTarget(workerId: string): Promise<{ profession: (Named & { id: string }) | null; regionId: string | null }> {
  const supabase = await createClient();
  // FK nomi aniq: worker_professions (ko'p-ko'p) tufayli oddiy "profession_nodes(...)" PostgREST'da ikki ma'noli (PGRST201)
  const { data, error } = await supabase
    .from("worker_profiles")
    .select("region_id, profession_nodes!worker_profiles_profession_node_id_fkey(id, name_uz, name_ru, name_en)")
    .eq("id", workerId)
    .maybeSingle();
  // xato bo'lsa — "Yangi ishlar" (bosh sahifa ishlayveradi), lekin jim yutilmaydi
  if (error) console.warn("[home] worker target", error.code, error.message);
  return { profession: data?.profession_nodes ?? null, regionId: data?.region_id ?? null };
}

/**
 * Ish qidiruvchining bosh sahifa ro'yxati — faqat haqiqiy faol e'lonlar, soxta moslik foizi yo'q:
 *  1) profilda kasb bor — shu kasb, avval o'z viloyatida, bo'lmasa butun O'zbekiston bo'yicha ("Sizga mos ishlar");
 *  2) aks holda (yoki topilmasa) — eng yangi e'lonlar eslab qolingan hududda, u yerda bo'lmasa butun O'zbekistonda.
 * Texnik xato bo'sh ro'yxat deb ko'rsatilmaydi.
 */
export async function getSeekerFeed(session: SessionContext | null, place: HomePlace): Promise<FeedResult<JobFeed>> {
  const regions = await getRegions();
  const target = session?.workerId ? await workerTarget(session.workerId) : null;
  const profession = target?.profession ?? null;
  if (profession) {
    const home = target?.regionId ? (regions.find((r) => r.id === target.regionId) ?? null) : null;
    for (const region of home ? [home, null] : [null]) {
      const res = await findJobs({ ...EMPTY_FIND, mode: "jobs", p: profession.id }, { regionId: region?.id ?? null, districtId: null, remote: false }, HOME_LIST);
      if (!res.ok) return res;
      if (res.items.length) {
        return {
          ok: true,
          kind: "match",
          items: res.items,
          total: res.total,
          images: res.images,
          photos: res.photos ?? {},
          profession,
          region,
          district: null,
          noMatchFor: null,
          allHref: findHref(EMPTY_FIND, { mode: "jobs", p: profession.id, region: region?.slug ?? "all", district: region ? "all" : null }),
        };
      }
    }
  }
  for (const where of place.region ? [place, { region: null, district: null }] : [place]) {
    const res = await findJobs({ ...EMPTY_FIND, mode: "jobs", any: true }, { regionId: where.region?.id ?? null, districtId: where.district?.id ?? null, remote: false }, HOME_LIST);
    if (!res.ok) return res;
    if (res.items.length || !where.region) {
      return {
        ok: true,
        kind: "new",
        items: res.items,
        total: res.total,
        images: res.images,
        photos: res.photos ?? {},
        profession: null,
        region: where.region,
        district: where.district,
        noMatchFor: profession,
        allHref: findHref(EMPTY_FIND, { mode: "jobs", any: true, region: where.region?.slug ?? "all", district: where.region ? (where.district?.id ?? "all") : null }),
      };
    }
  }
  // yuqoridagi tsikl doim qaytaradi (oxirgi urinish — butun O'zbekiston)
  return { ok: false, errorId: "unreachable" };
}

export interface WorkerFeed {
  ok: true;
  items: WorkerRow[];
  total: number;
  images: Record<string, string>;
  region: Region | null;
  allHref: string;
}

/** Ish beruvchi (mehmon yoki profil to'ldirilmagan): eng yangi ochiq ishchi e'lonlari — hududda, bo'lmasa butun O'zbekiston */
export async function getNewWorkers(place: HomePlace, limit = 6): Promise<FeedResult<WorkerFeed>> {
  for (const where of place.region ? [place, { region: null, district: null }] : [place]) {
    const res = await findWorkers({ ...EMPTY_FIND, mode: "workers", any: true }, { regionId: where.region?.id ?? null, districtId: where.district?.id ?? null, remote: false }, limit);
    if (!res.ok) return res;
    if (res.items.length || !where.region) {
      return {
        ok: true,
        items: res.items,
        total: res.total,
        images: res.images,
        region: where.region,
        allHref: findHref(EMPTY_FIND, { mode: "workers", any: true, region: where.region?.slug ?? "all", district: where.region ? (where.district?.id ?? "all") : null }),
      };
    }
  }
  return { ok: false, errorId: "unreachable" };
}

export interface PopularProfession extends Named {
  id: string;
  icon: string | null;
}

const POPULAR = 10;

/** Faol e'lonlari eng ko'p kasblar: oxirgi 500 ta faol e'lon bo'yicha (soni ko'rsatilmaydi — taxminiy tartib uchun) */
async function loadPopular(): Promise<PopularProfession[]> {
  const { data, error } = await createPublicClient()
    .from("vacancies")
    .select("profession_node_id, profession_nodes(id, name_uz, name_ru, name_en, icon, selectable, is_active)")
    .eq("status", "active")
    .not("profession_node_id", "is", null)
    .order("published_at", { ascending: false })
    .limit(500);
  // xato keshlanmasin
  if (error) throw new Error(`home_popular: ${error.message}`);
  const by = new Map<string, { node: PopularProfession; n: number }>();
  for (const row of data ?? []) {
    const node = row.profession_nodes;
    if (!node || !node.selectable || !node.is_active) continue;
    const cur = by.get(node.id);
    if (cur) cur.n += 1;
    else by.set(node.id, { node: { id: node.id, name_uz: node.name_uz, name_ru: node.name_ru, name_en: node.name_en, icon: node.icon }, n: 1 });
  }
  return [...by.values()]
    .sort((a, b) => b.n - a.n || a.node.name_uz.localeCompare(b.node.name_uz))
    .slice(0, POPULAR)
    .map((x) => x.node);
}

// bozor paneli bilan bir xil kesh qoidasi: MARKET_CACHE_SECONDS=0 — keshsiz (E2E stend)
const TTL = Number(process.env.MARKET_CACHE_SECONDS ?? 600);
const cachedPopular = unstable_cache(loadPopular, ["home-popular-professions-v1"], { revalidate: TTL > 0 ? TTL : 600, tags: ["market"] });

/** Xato bo'lsa — bo'sh (bo'lim ko'rsatilmaydi, qolgan sahifa ishlaydi) */
export async function getPopularProfessions(): Promise<PopularProfession[]> {
  try {
    return TTL > 0 ? await cachedPopular() : await loadPopular();
  } catch (error) {
    console.warn("[home] popular", error instanceof Error ? error.message : error);
    return [];
  }
}
