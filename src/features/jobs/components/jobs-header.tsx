import { getT } from "@/lib/i18n/server";
import { getJobsFilterRefs } from "../queries";
import { FiltersBar } from "./filters-bar";
import { JobsSearchBar } from "./jobs-search-bar";

/** /jobs yuqori qismi (layout'da — natijalar yuklanayotganda ham ko'rinib turadi) */
export async function JobsHeader() {
  const [{ t }, refs] = await Promise.all([getT(), getJobsFilterRefs()]);
  return (
    <div className="space-y-3">
      <h1 className="sr-only">{t("jobs.search.title")}</h1>
      <JobsSearchBar />
      <FiltersBar refs={refs} />
    </div>
  );
}
