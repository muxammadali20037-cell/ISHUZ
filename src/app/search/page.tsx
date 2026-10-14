import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getT } from "@/lib/i18n/server";
import { getCategories, getDistricts, getRegions } from "@/lib/reference";
import { Shell } from "@/components/shared/shell";
import { EMPTY_FIND, anyProfession, findHref, parseFindParams } from "@/features/find/params";
import { getNodeInfo } from "@/features/find/queries";
import { smartResolveQuery } from "@/features/find/ai-search";
import { getSession } from "@/features/auth/session";
import { trackServer } from "@/features/analytics/server";
import { FindAskIntent, FindResultsView, FindStart } from "@/features/find/components/find-page";
import { FindSteps } from "@/features/find/components/find-steps";
import { getMode } from "@/features/mode/server";
import { findModeOf, modeOfFind } from "@/features/mode/mode";
import { ModeGate } from "@/features/mode/components/mode-gate";
import { cookies } from "next/headers";
import { PLACE_COOKIE, parsePlace } from "@/features/find/place";
import { NearMe } from "@/features/find/components/near-me";
import { findJobs, findWorkers } from "@/features/find/queries";
import type { SearchPreview } from "@/features/find/components/newest-preview";
import type { JobCardData, WorkerCardData } from "@/features/find/components/result-cards";
import { isCityRegion } from "@/lib/geo/city";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("easy.search.page_title"), description: t("easy.home.search_desc") };
}

/**
 * Qidirish — har qadam URL'da: ish/ishchi → kasb → viloyat → tuman → natijalar.
 * Yozilgan matndan ("Toshkentda haydovchi kerak") maqsad, kasb va hudud oldindan to'ldiriladi; aniqlanmaganini so'raydi.
 * Rejim tanlangan bo'lsa (ish izlovchi / ish beruvchi) — "ish yoki ishchi?" so'ralmaydi, matn shu rejimda tushuniladi;
 * boshqa rejimning qidiruvi ochilsa — tushuntirish va tanlov (ModeGate), avtomatik almashtirilmaydi.
 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [params, mode, jar] = await Promise.all([searchParams.then(parseFindParams), getMode(), cookies()]);
  const place = parsePlace(jar.get(PLACE_COOKIE)?.value);
  const stored = mode ? findModeOf(mode) : null;

  // Matn → maqsad + kasb + hudud + filtrlar (lug'at, kerak bo'lsa AI); natija o'zgarsa — bir marta yo'naltiramiz.
  // Natijalar doim bazadagi haqiqiy e'lonlardan; AI faqat so'rovni tushunishga yordam beradi.
  if (params.q && !params.p) {
    const session = await getSession();
    const r = await smartResolveQuery(params.q, session?.userId ?? null, params.mode ?? stored);
    const target = findHref(params, {
      mode: params.mode ?? stored ?? r.mode,
      p: r.nodeId,
      region: params.region ?? (r.remote ? "remote" : r.regionSlug),
      district: params.district ?? r.districtId,
      q: r.nodeId ? "" : params.q,
      salary: params.salary ?? r.salary,
      schedule: params.schedule ?? r.schedule,
      noexp: params.noexp || r.noexp,
      exp: params.exp || r.exp,
      pay: params.pay ?? r.pay,
    });
    after(() => trackServer("search_submit", session?.userId ?? null, { source: r.source, found_profession: !!r.nodeId }));
    if (target !== findHref(params)) redirect(target);
  }

  // rejim bor, URL'da maqsad yo'q — savol bermasdan shu rejimning qidiruvi
  if (!params.mode && stored) redirect(findHref(params, { mode: stored }));
  // boshqa rejimning qidiruvi: tushuntirish + "o'tish" yoki o'z bo'limiga qaytish
  if (params.mode && mode && modeOfFind(params.mode) !== mode) {
    return (
      <Shell>
        <ModeGate variant="search" need={modeOfFind(params.mode)} otherHref={findHref(EMPTY_FIND, { mode: stored })} />
      </Shell>
    );
  }

  // ma'lumotnoma (kesh): kasb → viloyat → tuman qadamlari shu ma'lumot bilan telefonda almashadi
  const [categories, regions, allDistricts] = await Promise.all([getCategories(), getRegions(), getDistricts()]);
  const region = params.region && params.region !== "all" && params.region !== "remote" ? (regions.find((r) => r.slug === params.region) ?? null) : null;
  const regionKnown = params.region === "all" || params.region === "remote" || !!region;
  const districts = region ? allDistricts.filter((d) => d.region_id === region.id) : [];
  const district = region && params.district && params.district !== "all" ? (districts.find((d) => d.id === params.district) ?? null) : null;
  const districtKnown = params.district === "all" || !!district;
  const node = params.p ? await getNodeInfo(params.p) : null;

  // "Yaqin atrofda": eslab qolingan tuman bo'lsa — darhol natijalar; yo'q bo'lsa — joylashuvni aniqlash (yoki ro'yxatdan tanlash)
  if (params.mode && params.near && !regionKnown) {
    if (place && regions.some((r) => r.slug === place.region)) {
      redirect(findHref(params, { near: false, any: !params.p, region: place.region, district: place.district, page: 1 }));
    }
    return (
      <Shell>
        <NearMe base={params} regions={regions} districts={allDistricts} />
      </Shell>
    );
  }

  // maqsad aniqlanmagan, lekin kasb (yoki matn) bor — bitta savol: "Ish qidiryapsizmi yoki ishchi?"
  // "Kunlik ishlar" (pay=daily): kasb so'ralmaydi — darhol hudud
  const stepKey = !params.mode ? "intent" : (!params.p || !node) && !anyProfession(params) ? "profession" : !regionKnown ? "region" : region && !districtKnown ? "district" : "results";
  // ma'lumotnoma o'qilmadi (texnik xato) — bo'sh ro'yxat "hech narsa yo'q" deb ko'rsatilmaydi: xato sahifasi, URL saqlanadi
  if ((stepKey === "profession" && !categories.length) || (stepKey === "region" && !regions.length) || (stepKey === "district" && !districts.length)) {
    throw new Error(`reference_unavailable:${stepKey}`);
  }
  const view =
    stepKey === "intent" ? (
      params.q || node ? <FindAskIntent params={params} node={node} /> : <FindStart params={params} />
    ) : stepKey === "profession" || stepKey === "region" || stepKey === "district" ? (
      <FindSteps
        base={params}
        categories={categories}
        regions={regions}
        districts={allDistricts}
        initialNode={node ? { id: node.id, trail: node.trail } : null}
        myPlace={place}
        preview={stepKey === "profession" && !params.q ? await searchPreview(params, place, regions, allDistricts) : null}
      />
    ) : (
      <FindResultsView params={params} node={node} region={region} district={district} />
    );

  // qadamlar darhol almashadi: o'tish animatsiyasi bosishni bloklamasin (C7)
  return <Shell>{view}</Shell>;
}

/**
 * Qidiruv boshida (kasb tanlanmagan): "Barcha e'lonlar · N ta" va eng yangi 3 tasi — eslab qolingan hududda
 * (bo'lmasa — butun O'zbekiston). Xato bo'lsa — ko'rsatilmaydi (kasb tanlash ishlayveradi).
 */
async function searchPreview(
  params: ReturnType<typeof parseFindParams>,
  place: ReturnType<typeof parsePlace>,
  regions: Awaited<ReturnType<typeof getRegions>>,
  districts: Awaited<ReturnType<typeof getDistricts>>,
): Promise<SearchPreview | null> {
  if (!params.mode) return null;
  const { t, name } = await getT();
  const region = place ? (regions.find((r) => r.slug === place.region) ?? null) : null;
  const district = region && place && place.district !== "all" ? (districts.find((d) => d.id === place.district && d.region_id === region.id) ?? null) : null;
  const where = { regionId: region?.id ?? null, districtId: district?.id ?? null, remote: false };
  const base = { ...params, any: true, page: 1 };
  const jobs = params.mode === "jobs";
  const res = jobs ? await findJobs(base, where, 3) : await findWorkers(base, where, 3);
  if (!res.ok) return null;
  const placeLabel = region
    ? `${name(region)}${district ? ` · ${name(district)}` : ` · ${t(isCityRegion(region) ? "easy.location.whole_city" : "easy.location.whole_region")}`}`
    : t("easy.location.whole_country");
  return {
    mode: params.mode,
    total: res.total,
    allHref: findHref(EMPTY_FIND, { mode: params.mode, any: true, region: region?.slug ?? "all", district: region ? (district?.id ?? "all") : null }),
    placeLabel,
    jobs: jobs ? (res.items as unknown as JobCardData[]) : undefined,
    workers: jobs ? undefined : (res.items as unknown as WorkerCardData[]),
  };
}
