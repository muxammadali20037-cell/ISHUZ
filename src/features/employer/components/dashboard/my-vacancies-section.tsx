import Link from "next/link";
import { ChevronRight, Eye, Inbox } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatRelative } from "@/lib/format";
import { SectionHeader } from "@/components/ui/misc";
import { getMyVacancies } from "../../queries";
import { VacancyStatusBadge } from "./status-badge";

/** Mening vakansiyalarim: updated_at bo'yicha top 5 → /employer/vacancies/[id] */
export async function MyVacanciesSection({ userId, companyId, limit = 5, title }: { userId: string; companyId: string | null; limit?: number; title?: string }) {
  const { t, tEnum, locale } = await getT();
  const vacancies = await getMyVacancies(userId, companyId, limit);
  if (!vacancies.length) return null;
  return (
    <section className="mt-8">
      <SectionHeader title={title ?? t("employer.dashboard.my_vacancies")} href="/employer/vacancies" linkLabel={t("employer.dashboard.all")} />
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        {vacancies.map((v) => (
          <li key={v.id}>
            <Link href={`/employer/vacancies/${v.id}`} className="flex items-center gap-3 p-4 transition-colors hover:bg-secondary/60">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate font-semibold">{v.title}</h3>
                  <VacancyStatusBadge status={v.status} label={tEnum("vacancy_status", v.status)} />
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Inbox className="size-4" /> {t("employer.dashboard.applications_count", { count: v.applications_count })}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="size-4" /> {t("employer.dashboard.views_count", { count: v.views_count })}
                  </span>
                  <span className="hidden sm:inline">{t("common.labels.updated")}: {formatRelative(v.updated_at, locale)}</span>
                </div>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
