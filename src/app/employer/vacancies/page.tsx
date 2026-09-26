import type { Metadata } from "next";
import { requireEmployer } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { Shell } from "@/components/shared/shell";
import { getMyVacancies } from "@/features/vacancies/queries";
import { parseStatusFilter } from "@/features/vacancies/status";
import { VacancyList } from "@/features/vacancies/components/vacancy-list";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("vacancies.meta.list_title") };
}

/** /employer/vacancies — mening vakansiyalarim (holat bo'yicha ?status=) */
export default async function VacanciesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireEmployer("/employer/vacancies");
  const params = await searchParams;
  const filter = parseStatusFilter(params.status);
  const items = await getMyVacancies(session);
  return (
    <Shell>
      <div className="container-app py-5 sm:py-8">
        <VacancyList items={items} filter={filter} />
      </div>
    </Shell>
  );
}
