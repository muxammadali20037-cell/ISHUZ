import Link from "next/link";
import { after } from "next/server";
import { SearchX, Sparkles, UserX, AlertTriangle, Timer } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { EmptyState } from "@/components/ui/misc";
import { SmartEmptyState, type EmptySuggestion } from "@/components/shared/smart-empty-state";
import type { SessionContext } from "@/features/auth/session";
import { getSearchDictionary, logSearch } from "@/features/search/dictionary";
import { understandQuery } from "@/features/search/understand";
import type { Database } from "@/types/database.types";
import { EMPTY_WORKER_SEARCH, buildWorkersUrl, clearFilters, countActiveFilters, type WorkerSearchParams } from "../search-params";
import { countWorkers, searchWorkers } from "../queries";
import { workerRelaxations } from "../relax";
import type { DistanceOrigin } from "../types";
import { WorkerList } from "./worker-list";
import { SortSelect } from "./sort-select";
import { Pagination } from "./pagination";

type SearchArgs = Database["public"]["Functions"]["search_workers"]["Args"];

/** Natijalar (Suspense ichida): son + saralash + kartalar + sahifalash. Xatolar EmptyState bilan. */
export async function WorkersResults({
  params,
  args,
  origin,
  session,
}: {
  params: WorkerSearchParams;
  args: SearchArgs;
  origin: DistanceOrigin | null;
  session: Pick<SessionContext, "userId" | "companyId">;
}) {
  const { t } = await getT();
  const { rows, total, error } = await searchWorkers(args);

  const typed = params.from || params.q;
  if (typed && params.page === 1 && !error) {
    after(async () => {
      const dict = await getSearchDictionary();
      await logSearch({ scope: "workers", query: typed, understood: params.from ? understandQuery(params.from, dict) : null, results: total, profileId: session.userId });
    });
  }
  const understoodNote = params.from ? (
    <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-primary-soft/60 px-3 py-2 text-sm">
      <Sparkles className="size-4 shrink-0 text-primary" />
      <span className="min-w-0">{t("workers.search.understood", { query: params.from })}</span>
      <Link href={buildWorkersUrl({ ...EMPTY_WORKER_SEARCH, vacancy: params.vacancy, q: params.from, exact: true }, {})} className="font-semibold text-primary hover:underline">
        {t("workers.search.search_exact")}
      </Link>
    </p>
  ) : null;

  if (error === "employer_only" || error === "employer_profile_required") {
    return <EmptyState icon={UserX} title={t("workers.list.employer_only_title")} description={t("workers.list.employer_only_desc")} action={{ label: t("workers.list.employer_setup"), href: "/onboarding/employer" }} />;
  }
  if (error === "rate_limited") {
    return <EmptyState icon={Timer} title={t("common.errors.rate_limited")} description={t("workers.list.error_desc")} action={{ label: t("common.actions.retry"), href: buildWorkersUrl(params, { page: params.page }) }} />;
  }
  if (error) {
    return <EmptyState icon={AlertTriangle} title={t("workers.list.error_title")} description={t("workers.list.error_desc")} action={{ label: t("common.actions.retry"), href: buildWorkersUrl(params, { page: params.page }) }} />;
  }
  if (!rows.length) {
    const hasFilters = countActiveFilters(params) > 0 || !!params.q;
    const all = workerRelaxations(params);
    const options = all.length > 6 ? [...all.slice(0, 5), all[all.length - 1]!] : all;
    const counted = await Promise.all(options.map(async (o) => ({ ...o, count: await countWorkers(o.params, session) })));
    const suggestions: EmptySuggestion[] = counted
      .filter((o) => o.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
      .map((o) => ({ label: t(`workers.relax.${o.key}`), count: o.count, href: buildWorkersUrl({ ...o.params, from: "" }, { page: 1 }) }));
    return (
      <div>
        {understoodNote}
        <SmartEmptyState
          icon={SearchX}
          title={hasFilters ? t("workers.list.exact_empty_title") : t("workers.list.empty_title")}
          description={suggestions.length ? t("workers.list.relax_description") : t("workers.list.empty_desc")}
          suggestionsTitle={t("workers.list.relax_title")}
          suggestions={suggestions}
          countLabel={(count) => t("workers.list.relax_count", { count })}
          fallback={hasFilters ? { label: t("workers.list.clear_filters"), href: buildWorkersUrl({ ...clearFilters(params), q: null, from: "" }, {}) } : undefined}
        />
      </div>
    );
  }

  return (
    <div>
      {understoodNote}
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground tabular">{t("common.labels.results", { count: total })}</p>
        <SortSelect params={params} hasOrigin={origin !== null} />
      </div>
      <WorkerList rows={rows} vacancyId={args.p_vacancy_id ?? null} />
      <Pagination params={params} total={total} />
    </div>
  );
}
