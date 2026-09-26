import { getT } from "@/lib/i18n/server";
import { SectionHeader } from "@/components/ui/misc";
import { searchVacancyCards } from "../../queries";
import type { SearchVacanciesArgs } from "../../search-params";
import { VacancyList } from "../vacancy-list";

/** Bosh sahifa bo'limi: search_vacancies (limit 5) → gorizontal kartalar. Bo'sh bo'lsa ko'rinmaydi. */
export async function HomeSection({ title, href, args, limit = 5 }: { title: string; href: string; args: SearchVacanciesArgs; limit?: number }) {
  const [{ t }, items] = await Promise.all([getT(), searchVacancyCards({ ...args, p_limit: limit, p_offset: 0 })]);
  if (!items.length) return null;
  return (
    <section aria-label={title}>
      <SectionHeader title={title} href={href} linkLabel={t("common.actions.view_all")} />
      <VacancyList items={items} layout="row" />
    </section>
  );
}
