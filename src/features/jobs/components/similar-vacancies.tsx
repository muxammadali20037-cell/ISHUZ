import { getT } from "@/lib/i18n/server";
import { SectionHeader } from "@/components/ui/misc";
import { getSimilarVacancies } from "../queries";
import type { VacancyDetail } from "../types";
import { VacancyList } from "./vacancy-list";

/** "O'xshash vakansiyalar": shu kategoriya, joriysidan tashqari, 5 ta */
export async function SimilarVacancies({ vacancy }: { vacancy: VacancyDetail }) {
  const [{ t }, items] = await Promise.all([getT(), getSimilarVacancies(vacancy)]);
  if (!items.length) return null;
  const href = vacancy.category ? `/jobs?category=${vacancy.category.slug}` : "/jobs";
  return (
    <section className="mt-8">
      <SectionHeader title={t("jobs.detail.similar")} href={href} linkLabel={t("common.actions.view_all")} />
      <VacancyList items={items} layout="grid" />
    </section>
  );
}
