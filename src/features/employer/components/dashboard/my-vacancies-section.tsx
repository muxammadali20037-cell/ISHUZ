import Link from "next/link";
import { ChevronRight, Eye, Inbox } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatRelative } from "@/lib/format";
import { SectionHeader } from "@/components/ui/misc";
import { getMyVacancies } from "../../queries";
import { VacancyStatusBadge } from "./status-badge";

/**
 * Faol vakansiyalar (2026-10): kompyuterda jadval (lavozim · holat · arizalar · ko'rishlar · yangilangan), telefonda ixcham
 * qatorlar. Har qator → /employer/vacancies/[id].
 */
export async function MyVacanciesSection({ userId, companyId, limit = 5, title }: { userId: string; companyId: string | null; limit?: number; title?: string }) {
  const { t, tEnum, locale } = await getT();
  const vacancies = await getMyVacancies(userId, companyId, limit);
  if (!vacancies.length) return null;
  const heading = title ?? t("employer.dashboard.my_vacancies");
  return (
    <section aria-label={heading}>
      <SectionHeader title={heading} href="/employer/vacancies" linkLabel={t("employer.dashboard.all")} />
      {/* telefon / planshet */}
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card md:hidden">
        {vacancies.map((v) => (
          <li key={v.id}>
            <Link href={`/employer/vacancies/${v.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/60">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <h3 className="truncate font-semibold">{v.title}</h3>
                  <VacancyStatusBadge status={v.status} label={tEnum("vacancy_status", v.status)} />
                </div>
                <p className="mt-0.5 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Inbox className="size-4" aria-hidden /> {t("employer.dashboard.applications_count", { count: v.applications_count })}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="size-4" aria-hidden /> {t("employer.dashboard.views_count", { count: v.views_count })}
                  </span>
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      {/* kompyuter: jadval (qator bosilsa — vakansiya; havola nom katagida, butun qatorni qoplaydi) */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-secondary/60 text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold">{t("employer.dashboard.col_title")}</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">{t("employer.dashboard.col_status")}</th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("employer.dashboard.col_applications")}</th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("employer.dashboard.col_views")}</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">{t("employer.dashboard.col_updated")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {vacancies.map((v) => (
              <tr key={v.id} className="relative transition-colors hover:bg-secondary/60">
                <td className="max-w-0 px-4 py-3">
                  <Link href={`/employer/vacancies/${v.id}`} className="block truncate text-base font-semibold after:absolute after:inset-0 after:content-[''] hover:text-primary">
                    {v.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <VacancyStatusBadge status={v.status} label={tEnum("vacancy_status", v.status)} />
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular">{v.applications_count}</td>
                <td className="px-4 py-3 text-right tabular text-muted-foreground">{v.views_count}</td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatRelative(v.updated_at, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
