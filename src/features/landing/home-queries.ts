import "server-only";

import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient, PUBLIC_FEED_TAG } from "@/lib/supabase/public";
import { getDistricts, getRegions, type District, type Region } from "@/lib/reference";
import type { SessionContext } from "@/features/auth/session";
import { EMPTY_FIND, findHref } from "@/features/find/params";
import { PLACE_COOKIE, parsePlace } from "@/features/find/place";
import { findJobs, findWorkers, type JobRow, type WorkerRow } from "@/features/find/queries";
import { PREFS_COOKIE, parsePrefs } from "@/features/entry/prefs";

/** Bosh sahifadagi ro'yxat hajmi: telefonda 3–4 ta ekranga sig'adi, qolgani — "Barcha vakansiyalar" */
export const HOME_LIST = 8;

/**
 * Mehmon ro'yxati keshi ("Yangi e'lonlar" / "Yangi ishchilar" — hudud bo'yicha bir xil, foydalanuvchiga bog'liq emas).
 * Yuklama testi (docs/SCALE.md §8): 150 ming faol vakansiyada filtrsiz "eng yangi 8 ta" so'rovi ~200 ms — har bir mehmon
 * ochilishida takrorlanardi. Endi hudud bo'yicha 60 s keshda; e'lon joylansa/yopilsa updateTag(PUBLIC_FEED_TAG) darhol yangilaydi.
 * MARKET_CACHE_SECONDS=0 (E2E stend) — keshsiz. Xato keshlanmaydi (throw → chaqiruvchi { ok:false }).
 */
const FEED_TTL = Number(process.env.MARKET_CACHE_SECONDS ?? 600) > 0 ? 60 : 0;

class FeedError extends Error {
  constructor(readonly errorId: string) {
    super(`feed ${errorId}`);
  }
}

async function loadNewJobs(regionId: string | null, districtId: string | null, limit: number): Promise<JobFeedRows> {
  const res = await findJobs({ ...EMPTY_FIND, mode: "jobs", any: true }, { regionId, districtId, remote: false }, limit, createPublicClient());
  if (!res.ok) throw new FeedError(res.errorId);
  return { items: res.items, total: res.total, images: res.images, photos: res.photos ?? {} };
}

async function loadNewWorkers(regionId: string | null, districtId: string | null, limit: number): Promise<WorkerFeedRows> {
  const res = await findWorkers({ ...EMPTY_FIND, mode: "workers", any: true }, { regionId, districtId, remote: false }, limit, createPublicClient());
  if (!res.ok) throw new FeedError(res.errorId);
  return { items: res.items, total: res.total, images: res.images };
}

type JobFeedRows = { items: JobRow[]; total: number; images: Record<string, string>; photos: Record<string, string> };
type WorkerFeedRows = { items: WorkerRow[]; total: number; images: Record<string, string> };

const cachedNewJobs = unstable_cache(loadNewJobs, ["home-new-jobs-v1"], { revalidate: FEED_TTL || 60, tags: [PUBLIC_FEED_TAG] });
const cachedNewWorkers = unstable_cache(loadNewWorkers, ["home-new-workers-v2"], { revalidate: FEED_TTL || 60, tags: [PUBLIC_FEED_TAG] });

async function newJobs(regionId: string | null, districtId: string | null, limit: number): Promise<FeedResult<JobFeedRows>> {
  try {
    return FEED_TTL > 0 ? await cachedNewJobs(regionId, districtId, limit) : await loadNewJobs(regionId, districtId, limit);
  } catch (e) {
    if (e instanceof FeedError) return { ok: false, errorId: e.errorId };
    throw e;
  }
}

async function newWorkers(regionId: string | null, districtId: string | null, limit: number): Promise<FeedResult<WorkerFeedRows>> {
  try {
    return FEED_TTL > 0 ? await cachedNewWorkers(regionId, districtId, limit) : await loadNewWorkers(regionId, districtId, limit);
  } catch (e) {
    if (e instanceof FeedError) return { ok: false, errorId: e.errorId };
    throw e;
  }
}

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

/** 05 da tanlangan kasblar (shu qurilmada, ib_prefs) — faol tugunlar, tanlov tartibida */
async function prefProfessions(ids: string[]): Promise<(Named & { id: string })[]> {
  if (!ids.length) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("profession_nodes").select("id, name_uz, name_ru, name_en").in("id", ids).eq("is_active", true);
  if (error) console.warn("[home] pref professions", error.code, error.message);
  const byId = new Map((data ?? []).map((n) => [n.id, n]));
  return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
}

/**
 * Ish qidiruvchining bosh sahifa ro'yxati — faqat haqiqiy faol e'lonlar, soxta moslik foizi yo'q:
 *  1) profilda kasb bor — shu kasb, avval o'z viloyatida, bo'lmasa butun O'zbekiston bo'yicha ("Sizga mos ishlar");
 *     profilda kasb yo'q, lekin 05-ekranda kasblar tanlangan (ib_prefs) — ular tartib bilan, avval tanlangan hududda;
 *     "Tajriba yo'q" tanlangan bo'lsa — avval tajriba talab qilmaydiganlari;
 *  2) aks holda (yoki topilmasa) — eng yangi e'lonlar eslab qolingan hududda, u yerda bo'lmasa butun O'zbekistonda.
 * Texnik xato bo'sh ro'yxat deb ko'rsatilmaydi.
 */
export async function getSeekerFeed(session: SessionContext | null, place: HomePlace): Promise<FeedResult<JobFeed>> {
  const regions = await getRegions();
  const target = session?.workerId ? await workerTarget(session.workerId) : null;
  const prefs = target?.profession ? null : parsePrefs((await cookies()).get(PREFS_COOKIE)?.value);
  const candidates = target?.profession ? [target.profession] : await prefProfessions(prefs?.professions ?? []);
  const profession = candidates[0] ?? null;
  const home = target?.profession ? (target.regionId ? (regions.find((r) => r.id === target.regionId) ?? null) : null) : place.region;
  // ustuvorlik tartibida: (tajriba talab qilmaydigan →) hudud → butun O'zbekiston; har birida kasblar tanlov tartibida.
  // Hammasi parallel so'raladi (bosh sahifa ketma-ket kutmaydi), birinchi bo'sh bo'lmagani olinadi.
  const attempts = (prefs?.experience === "none" ? [true, false] : [false]).flatMap((noexp) =>
    (home ? [home, null] : [null]).flatMap((region) => candidates.slice(0, 3).map((prof) => ({ prof, region, noexp }))),
  );
  const results = await Promise.all(
    attempts.map(({ prof, region, noexp }) => findJobs({ ...EMPTY_FIND, mode: "jobs", p: prof.id, noexp }, { regionId: region?.id ?? null, districtId: null, remote: false }, HOME_LIST)),
  );
  for (const [i, res] of results.entries()) {
    if (!res.ok) return res;
    if (!res.items.length) continue;
    const { prof, region } = attempts[i]!;
    return {
      ok: true,
      kind: "match",
      items: res.items,
      total: res.total,
      images: res.images,
      photos: res.photos ?? {},
      profession: prof,
      region,
      district: null,
      noMatchFor: null,
      allHref: findHref(EMPTY_FIND, { mode: "jobs", p: prof.id, region: region?.slug ?? "all", district: region ? "all" : null }),
    };
  }
  for (const where of place.region ? [place, { region: null, district: null }] : [place]) {
    const res = await newJobs(where.region?.id ?? null, where.district?.id ?? null, HOME_LIST);
    if (!("items" in res)) return res;
    if (res.items.length || !where.region) {
      return {
        ok: true,
        kind: "new",
        items: res.items,
        total: res.total,
        images: res.images,
        photos: res.photos,
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
    const res = await newWorkers(where.region?.id ?? null, where.district?.id ?? null, limit);
    if (!("items" in res)) return res;
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
