import type { Metadata } from "next";
import { JobsResults } from "@/features/jobs/components/jobs-results";
import { jobsListMetadata } from "@/features/jobs/metadata";
import { parseJobsSearchParams } from "@/features/jobs/search-params";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return jobsListMetadata(parseJobsSearchParams(await searchParams));
}

/** /jobs — ommaviy qidiruv (anonim ham). Filtrlar URL da. */
export default async function JobsPage({ searchParams }: Props) {
  const params = parseJobsSearchParams(await searchParams);
  return <JobsResults params={params} />;
}
