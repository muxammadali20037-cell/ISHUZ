import { Suspense } from "react";
import type { Metadata } from "next";
import { requireEmployer } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { getReferenceData } from "@/lib/reference";
import { Shell } from "@/components/shared/shell";
import { parseWorkerSearchParams, serializeWorkerSearchParams } from "@/features/workers/search-params";
import { resolveSearch, getSkillOptions } from "@/features/workers/queries";
import { WorkersSearch } from "@/features/workers/components/workers-search";
import { WorkersResults } from "@/features/workers/components/workers-results";
import { WorkersResultsSkeleton } from "@/features/workers/components/skeletons";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("workers.meta.search_title"), description: t("workers.meta.search_description"), robots: { index: false } };
}

/**
 * /workers — ish beruvchi uchun nomzodlar qidiruvi. Holat URL'da (searchParams → search_workers RPC).
 * Sarlavha (filtrlar) darhol, natijalar Suspense ichida (skeleton).
 */
export default async function WorkersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireEmployer("/workers");
  const params = parseWorkerSearchParams(await searchParams);
  const [{ args, category, vacancy, origin, myVacancies }, reference] = await Promise.all([resolveSearch(params, session), getReferenceData()]);
  const skills = await getSkillOptions(category?.id ?? null, params.skills);
  const key = serializeWorkerSearchParams(params);

  return (
    <Shell>
      <div className="container-app py-4 md:py-6">
        <WorkersSearch
          params={params}
          reference={{
            categories: reference.categories,
            subcategories: reference.subcategories,
            regions: reference.regions,
            districts: reference.districts.map((d) => ({ id: d.id, region_id: d.region_id, name_uz: d.name_uz, name_ru: d.name_ru })),
            languages: reference.languages,
            skills,
          }}
          vacancies={myVacancies}
          vacancy={vacancy}
          origin={origin}
        />
        <div className="mt-5">
          <Suspense key={key} fallback={<WorkersResultsSkeleton />}>
            <WorkersResults params={params} args={args} origin={origin} />
          </Suspense>
        </div>
      </div>
    </Shell>
  );
}
