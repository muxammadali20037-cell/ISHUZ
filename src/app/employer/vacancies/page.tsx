import type { Metadata } from "next";
import { requireEmployer } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { Shell } from "@/components/shared/shell";
import { getMyVacancies } from "@/features/vacancies/queries";
import { parseStatusFilter } from "@/features/vacancies/status";
import { VacancyList } from "@/features/vacancies/components/vacancy-list";
import { getMyListings } from "@/features/cabinet/queries";
import { getMyMasterListings } from "@/features/masters/queries";
import { MyListingsSection } from "@/features/cabinet/components/my-listings";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("vacancies.meta.list_title") };
}

/**
 * /employer/vacancies — ish beruvchi rejimidagi "E'lonlarim": vakansiyalar (holat bo'yicha ?status=) va ostida egasining
 * boshqa e'lonlari — o'zi haqidagi (ishchi) e'lon va usta e'lonlari, holati bilan (ega, 2026-11-20: "e'lon egasi
 * e'lonlarimdan o'z e'lonlarini, barcha e'lonlarini ko'rolmayapti" — rejim almashsa ham joylagani yo'qolmasin).
 */
export default async function VacanciesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireEmployer("/employer/vacancies");
  const params = await searchParams;
  const filter = parseStatusFilter(params.status);
  const [{ t }, items, { workers, paid }, masters] = await Promise.all([
    getT(),
    getMyVacancies(session),
    getMyListings(session, { vacancies: false }),
    getMyMasterListings(session.userId),
  ]);
  return (
    <Shell>
      <div className="container-app py-5 sm:py-8">
        <VacancyList items={items} filter={filter} />
        {workers.length || masters.length ? (
          <div className="mt-8 max-w-2xl space-y-3 border-t border-border/70 pt-6" data-other-listings>
            <h2 className="text-section font-bold tracking-tight">{t("vacancies.list.other_listings")}</h2>
            <MyListingsSection workers={workers} vacancies={[]} paid={paid} masters={masters} />
          </div>
        ) : null}
      </div>
    </Shell>
  );
}
