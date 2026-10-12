import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getT } from "@/lib/i18n/server";
import { getCategories, getDistricts, getRegions } from "@/lib/reference";
import { Shell } from "@/components/shared/shell";
import { anyProfession, findHref, parseFindParams } from "@/features/find/params";
import { getNodeInfo } from "@/features/find/queries";
import { smartResolveQuery } from "@/features/find/ai-search";
import { getSession } from "@/features/auth/session";
import { trackServer } from "@/features/analytics/server";
import { FindAskIntent, FindResultsView, FindStart } from "@/features/find/components/find-page";
import { FindSteps } from "@/features/find/components/find-steps";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("easy.search.page_title"), description: t("easy.home.search_desc") };
}

/**
 * Qidirish — har qadam URL'da: ish/ishchi → kasb → viloyat → tuman → natijalar.
 * Yozilgan matndan ("Toshkentda haydovchi kerak") maqsad, kasb va hudud oldindan to'ldiriladi; aniqlanmaganini so'raydi.
 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = parseFindParams(await searchParams);

  // Matn → maqsad + kasb + hudud + filtrlar (lug'at, kerak bo'lsa AI); natija o'zgarsa — bir marta yo'naltiramiz.
  // Natijalar doim bazadagi haqiqiy e'lonlardan; AI faqat so'rovni tushunishga yordam beradi.
  if (params.q && !params.p) {
    const session = await getSession();
    const r = await smartResolveQuery(params.q, session?.userId ?? null, params.mode);
    const target = findHref(params, {
      mode: params.mode ?? r.mode,
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

  // ma'lumotnoma (kesh): kasb → viloyat → tuman qadamlari shu ma'lumot bilan telefonda almashadi
  const [categories, regions, allDistricts] = await Promise.all([getCategories(), getRegions(), getDistricts()]);
  const region = params.region && params.region !== "all" && params.region !== "remote" ? (regions.find((r) => r.slug === params.region) ?? null) : null;
  const regionKnown = params.region === "all" || params.region === "remote" || !!region;
  const districts = region ? allDistricts.filter((d) => d.region_id === region.id) : [];
  const district = region && params.district && params.district !== "all" ? (districts.find((d) => d.id === params.district) ?? null) : null;
  const districtKnown = params.district === "all" || !!district;
  const node = params.p ? await getNodeInfo(params.p) : null;

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
      <FindSteps base={params} categories={categories} regions={regions} districts={allDistricts} initialNode={node ? { id: node.id, trail: node.trail } : null} />
    ) : (
      <FindResultsView params={params} node={node} region={region} district={district} />
    );

  // qadamlar darhol almashadi: o'tish animatsiyasi bosishni bloklamasin (C7)
  return <Shell>{view}</Shell>;
}
