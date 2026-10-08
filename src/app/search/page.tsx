import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getT } from "@/lib/i18n/server";
import { getCategories, getDistricts, getRegions } from "@/lib/reference";
import { Shell } from "@/components/shared/shell";
import { findHref, parseFindParams } from "@/features/find/params";
import { getNodeInfo } from "@/features/find/queries";
import { smartResolveQuery } from "@/features/find/ai-search";
import { getSession } from "@/features/auth/session";
import { trackServer } from "@/features/analytics/server";
import { FindAskIntent, FindDistrict, FindProfession, FindRegion, FindResultsView, FindStart } from "@/features/find/components/find-page";

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
    });
    after(() => trackServer("search_submit", session?.userId ?? null, { source: r.source, found_profession: !!r.nodeId }));
    if (target !== findHref(params)) redirect(target);
  }

  const [categories, regions] = await Promise.all([getCategories(), getRegions()]);
  const region = params.region && params.region !== "all" && params.region !== "remote" ? (regions.find((r) => r.slug === params.region) ?? null) : null;
  const regionKnown = params.region === "all" || params.region === "remote" || !!region;
  const districts = region ? await getDistricts(region.id) : [];
  const district = region && params.district && params.district !== "all" ? (districts.find((d) => d.id === params.district) ?? null) : null;
  const districtKnown = params.district === "all" || !!district;
  const node = params.p ? await getNodeInfo(params.p) : null;

  let view;
  // maqsad aniqlanmagan, lekin kasb (yoki matn) bor — bitta savol: "Ish qidiryapsizmi yoki ishchi?"
  if (!params.mode) view = params.q || node ? <FindAskIntent params={params} node={node} /> : <FindStart params={params} />;
  else if (!params.p || !node) view = <FindProfession params={params} categories={categories} />;
  else if (!regionKnown) view = <FindRegion params={params} regions={regions} node={node} />;
  else if (region && !districtKnown) view = <FindDistrict params={params} region={region} districts={districts} node={node} />;
  else view = <FindResultsView params={params} node={node} region={region} district={district} />;

  return <Shell>{view}</Shell>;
}
