import { SearchX, Sparkles } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { EmptyState } from "@/components/ui/misc";
import { searchVacancies } from "../queries";
import { clearFilters, jobsHref, type JobsSearchParams } from "../search-params";
import { Pagination } from "./pagination";
import { SortSelect } from "./sort-select";
import { VacancyList } from "./vacancy-list";

/** Qidiruv natijalari: soni + saralash, kartalar, sahifalash / bo'sh holat */
export async function JobsResults({ params }: { params: JobsSearchParams }) {
  const [{ t, name }, result] = await Promise.all([getT(), searchVacancies(params)]);

  if (!result.items.length) {
    return (
      <EmptyState
        className="mt-4"
        icon={SearchX}
        title={t("jobs.empty.title")}
        description={t("jobs.empty.description")}
        action={{ label: t("jobs.empty.action"), href: jobsHref(clearFilters({ ...params, q: "" })) }}
      />
    );
  }

  const smartName = result.smart ? [name(result.smart.category), result.smart.subcategory ? name(result.smart.subcategory) : null].filter(Boolean).join(" › ") : null;

  return (
    <section className="mt-4" aria-label={t("jobs.search.title")}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {params.q ? t("jobs.search.results_for", { query: params.q, count: result.total }) : t("jobs.search.results", { count: result.total })}
          </p>
          {smartName ? (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" /> {t("jobs.search.smart_category", { name: smartName })}
            </p>
          ) : null}
        </div>
        <SortSelect params={params} />
      </div>
      <VacancyList items={result.items} layout="grid" />
      <Pagination params={params} pageCount={result.pageCount} />
    </section>
  );
}
