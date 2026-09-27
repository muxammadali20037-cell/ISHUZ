import Link from "next/link";
import { after } from "next/server";
import { SearchX, Sparkles } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getSession } from "@/features/auth/session";
import { SmartEmptyState, type EmptySuggestion } from "@/components/shared/smart-empty-state";
import { getSearchDictionary, logSearch } from "@/features/search/dictionary";
import { understandQuery } from "@/features/search/understand";
import { countVacancies, searchVacancies } from "../queries";
import { jobsRelaxations } from "../relax";
import { DEFAULT_JOBS_PARAMS, clearFilters, jobsHref, type JobsSearchParams } from "../search-params";
import { Pagination } from "./pagination";
import { SortSelect } from "./sort-select";
import { VacancyList } from "./vacancy-list";

/** Qidiruv natijalari: soni + saralash, kartalar, sahifalash / aqlli bo'sh holat */
export async function JobsResults({ params }: { params: JobsSearchParams }) {
  const [{ t, name }, result] = await Promise.all([getT(), searchVacancies(params)]);

  // Qidiruv jurnali: faqat birinchi sahifa va matnli qidiruvlar (javobni kutmaydi)
  const typed = params.from || params.q;
  if (typed && params.page === 1) {
    after(async () => {
      const [session, dict] = await Promise.all([getSession(), getSearchDictionary()]);
      await logSearch({ scope: "jobs", query: typed, understood: params.from ? understandQuery(params.from, dict) : null, results: result.total, profileId: session?.userId ?? null });
    });
  }

  const understoodNote = params.from ? (
    <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-primary-soft/60 px-3 py-2 text-sm">
      <Sparkles className="size-4 shrink-0 text-primary" />
      <span className="min-w-0">{t("jobs.search.understood", { query: params.from })}</span>
      <Link href={jobsHref({ ...DEFAULT_JOBS_PARAMS, q: params.from, exact: true })} className="font-semibold text-primary hover:underline">
        {t("jobs.search.search_exact")}
      </Link>
    </p>
  ) : null;

  if (!result.items.length) {
    const options = jobsRelaxations(params);
    const counted = await Promise.all(options.map(async (o) => ({ ...o, count: await countVacancies(o.params) })));
    const suggestions: EmptySuggestion[] = counted
      .filter((o) => o.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
      .map((o) => ({ label: t(`jobs.relax.${o.key}`), count: o.count, href: jobsHref({ ...o.params, from: "" }) }));
    return (
      <div className="mt-4">
        {understoodNote}
        <SmartEmptyState
          icon={SearchX}
          title={options.length ? t("jobs.empty.exact_title") : t("jobs.empty.title")}
          description={suggestions.length ? t("jobs.empty.relax_description") : t("jobs.empty.description")}
          suggestionsTitle={t("jobs.empty.relax_title")}
          suggestions={suggestions}
          countLabel={(count) => t("jobs.empty.count", { count })}
          fallback={options.length ? { label: t("jobs.empty.action"), href: jobsHref(clearFilters({ ...params, q: "" })) } : undefined}
        />
      </div>
    );
  }

  const smartName = result.smart
    ? [name(result.smart.category), result.smart.subcategory ? name(result.smart.subcategory) : null].filter(Boolean).join(" › ")
    : null;

  return (
    <section className="mt-4" aria-label={t("jobs.search.title")}>
      {understoodNote}
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
