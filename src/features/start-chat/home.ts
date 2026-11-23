import "server-only";

import type { SessionContext } from "@/features/auth/session";
import type { AppMode } from "@/features/mode/mode";
import { EMPTY_FIND, findHref } from "@/features/find/params";
import { PLACE_COOKIE, parsePlace } from "@/features/find/place";
import { placeOptions, runQuick } from "@/features/find/quick-core";
import { NO_FILTERS, type QuickList, type QuickMode, type QuickOption } from "@/features/find/quick-types";

/** Bosh sahifada ko'rsatiladigan eng yangi e'lonlar soni */
const LATEST = 2;

export interface HomeLatest {
  mode: QuickMode;
  list: QuickList;
  saved: string[];
  /** barcha faol e'lonlar (butun O'zbekiston, kasbsiz) */
  allHref: string;
}

export interface HomeData {
  mode: QuickMode;
  /** qidiruv qatoridagi hudud ro'yxati ("Butun O'zbekiston", "Masofaviy", viloyatlar) */
  places: QuickOption[];
  /** boshlang'ich hudud: shu qurilmada eslab qolingan viloyat, bo'lmasa — butun O'zbekiston */
  place: string;
  /** eng yangi haqiqiy e'lonlar — sahifa ko'rsatilgach oqim bilan keladi (kutilmaydi); xato yoki bo'sh — null */
  latest: Promise<HomeLatest | null>;
}

/**
 * Bosh ekran (chat bo'sh holati) ma'lumotlari — ega, 2026-11-23, C varianti: qidiruv qatori (kasb + hudud), tezkor bo'limlar
 * va eng yangi e'lonlar. Ish beruvchi rejimida — ishchilar. Faqat bazadagi haqiqiy e'lonlar; hech narsa o'ylab topilmaydi.
 */
export async function homeData(appMode: AppMode | null, session: SessionContext | null, cookie: (name: string) => string | undefined): Promise<HomeData | null> {
  const mode: QuickMode = appMode === "employer" ? "workers" : "jobs";
  // hududlar o'qilmadi (texnik xato) — bosh ekran avvalgi ko'rinishda (ikki tugma va yozish maydoni), sahifa yiqilmaydi
  const places = await placeOptions(mode).catch(() => null);
  if (!places || places.length < 2) return null;
  const remembered = parsePlace(cookie(PLACE_COOKIE))?.region;
  const place = remembered && places.some((p) => p.value === remembered) ? remembered : "all";
  return { mode, places, place, latest: homeLatest(mode, session) };
}

async function homeLatest(mode: QuickMode, session: SessionContext | null): Promise<HomeLatest | null> {
  try {
    // prefetch: qidiruv saqlanmaydi va statistikaga yozilmaydi (foydalanuvchi hech narsa qidirmadi)
    const res = await runQuick({ mode, answers: { profession: "", nodeId: null, place: "all", salary: null, filters: NO_FILTERS }, session, prefetch: true });
    if (!res.ok || res.data.total === 0) return null;
    const r = res.data;
    const jobs = r.jobs.slice(0, LATEST);
    const workers = r.workers.slice(0, LATEST);
    // sahifaga faqat ko'rsatiladiganlarning suratlari (kasb rasmlari — kasb bo'yicha, kichik)
    const ids = new Set([...jobs, ...workers].map((x) => x.id));
    const only = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).filter(([id]) => ids.has(id)));
    return {
      mode,
      list: { jobs, workers, images: r.images, photos: only(r.photos), aiImages: r.aiImages ? only(r.aiImages) : undefined, total: r.total, href: r.href },
      saved: r.saved,
      allHref: findHref(EMPTY_FIND, { mode, any: true, region: "all" }),
    };
  } catch (e) {
    console.error(JSON.stringify({ home_latest_error: e instanceof Error ? e.message.slice(0, 160) : "error" }));
    return null;
  }
}
