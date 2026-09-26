import { SearchX, UserX, AlertTriangle, Timer } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { EmptyState } from "@/components/ui/misc";
import type { Database } from "@/types/database.types";
import { buildWorkersUrl, clearFilters, countActiveFilters, type WorkerSearchParams } from "../search-params";
import { searchWorkers } from "../queries";
import type { DistanceOrigin } from "../types";
import { WorkerList } from "./worker-list";
import { SortSelect } from "./sort-select";
import { Pagination } from "./pagination";

type SearchArgs = Database["public"]["Functions"]["search_workers"]["Args"];

/** Natijalar (Suspense ichida): son + saralash + kartalar + sahifalash. Xatolar EmptyState bilan. */
export async function WorkersResults({ params, args, origin }: { params: WorkerSearchParams; args: SearchArgs; origin: DistanceOrigin | null }) {
  const { t } = await getT();
  const { rows, total, error } = await searchWorkers(args);

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
    return (
      <EmptyState
        icon={SearchX}
        title={t("workers.list.empty_title")}
        description={t("workers.list.empty_desc")}
        action={hasFilters ? { label: t("workers.list.clear_filters"), href: buildWorkersUrl({ ...clearFilters(params), q: null }, {}) } : undefined}
      />
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground tabular">{t("common.labels.results", { count: total })}</p>
        <SortSelect params={params} hasOrigin={origin !== null} />
      </div>
      <WorkerList rows={rows} vacancyId={args.p_vacancy_id ?? null} />
      <Pagination params={params} total={total} />
    </div>
  );
}
