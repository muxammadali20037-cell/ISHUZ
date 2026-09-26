import Link from "next/link";
import { Suspense } from "react";
import { Users, Filter, ArrowUpRight } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { canEditVacancy, getPipelineCounts, getVacancyApplications } from "../queries";
import type { ManagedVacancy, PipelineSort, PipelineStatusFilter } from "../types";
import { ApplicantCard } from "./applicant-card";
import { PipelineFilters } from "./pipeline-filters";

/** /employer/vacancies/[id]/applications — nomzodlar pipeline'i */
export async function EmployerPipeline({ vacancy, status, sort }: { vacancy: ManagedVacancy; status: PipelineStatusFilter; sort: PipelineSort }) {
  const { t } = await getT();
  const [counts, items, canAct] = await Promise.all([getPipelineCounts(vacancy.id), getVacancyApplications(vacancy.id, { status, sort }), canEditVacancy(vacancy.id)]);

  return (
    <div className="container-app py-4 sm:py-8">
      <PageHeader
        title={vacancy.title}
        subtitle={t("applications.pipeline.count", { count: counts.all })}
        backHref={`/employer/vacancies/${vacancy.id}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/employer/vacancies/${vacancy.id}`}>
              {t("applications.pipeline.back_to_vacancy")} <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        }
      />
      <Suspense fallback={null}>
        <PipelineFilters counts={counts} status={status} sort={sort} />
      </Suspense>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {items.length ? (
          items.map((item) => <ApplicantCard key={item.id} item={item} canAct={canAct} />)
        ) : counts.all === 0 ? (
          <EmptyState icon={Users} title={t("applications.pipeline.empty_title")} description={t("applications.pipeline.empty_desc")} className="md:col-span-2" />
        ) : (
          <EmptyState
            icon={Filter}
            title={t("applications.pipeline.filter_empty_title")}
            description={t("applications.pipeline.filter_empty_desc")}
            action={{ label: t("applications.pipeline.filter_all"), href: `/employer/vacancies/${vacancy.id}/applications` }}
            className="md:col-span-2"
          />
        )}
      </div>
    </div>
  );
}
