import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { JobsResults } from "@/features/jobs/components/jobs-results";
import { jobsListMetadata } from "@/features/jobs/metadata";
import { jobsHref, parseJobsSearchParams } from "@/features/jobs/search-params";
import { applyUnderstoodToJobs } from "@/features/search/apply";
import { getSearchDictionary } from "@/features/search/dictionary";
import { understandQuery } from "@/features/search/understand";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return jobsListMetadata(parseJobsSearchParams(await searchParams));
}

/** /jobs — ommaviy qidiruv (anonim ham). Filtrlar URL da. */
export default async function JobsPage({ searchParams }: Props) {
  const params = parseJobsSearchParams(await searchParams);
  // "chilonzorda kechki smenaga kassir" → tuman, grafik, kasb filtrlari (aynan qidiruv so'ralmagan bo'lsa)
  if (params.q && !params.exact) {
    const next = applyUnderstoodToJobs(params, understandQuery(params.q, await getSearchDictionary()), params.q);
    if (next) redirect(jobsHref(next));
  }
  return <JobsResults params={params} />;
}
