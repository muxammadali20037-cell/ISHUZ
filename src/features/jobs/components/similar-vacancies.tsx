import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { SectionHeader } from "@/components/ui/misc";
import { SalaryText } from "@/components/shared/salary-text";
import { getSimilarVacancies } from "../queries";
import type { VacancyDetail } from "../types";

/** "O'xshash vakansiyalar": shu kategoriya, joriysidan tashqari, 5 ta — ixcham qatorlar (nomi, maosh, joy · ish beruvchi) */
export async function SimilarVacancies({ vacancy }: { vacancy: VacancyDetail }) {
  const [{ t, locale }, items] = await Promise.all([getT(), getSimilarVacancies(vacancy)]);
  if (!items.length) return null;
  const href = vacancy.category ? `/jobs?category=${vacancy.category.slug}` : "/jobs";
  const ru = locale === "ru";
  return (
    <section className="mt-6">
      <SectionHeader title={t("jobs.detail.similar")} href={href} linkLabel={t("common.actions.view_all")} />
      <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {items.map((v) => {
          const place = v.is_remote
            ? t("jobs.detail.remote")
            : [ru ? (v.district_name_ru ?? v.district_name_uz) : v.district_name_uz, ru ? (v.region_name_ru ?? v.region_name_uz) : v.region_name_uz].filter(Boolean).join(", ");
          return (
            <li key={v.id}>
              <Link
                href={`/jobs/${v.slug}`}
                className="press flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm hover:border-primary/50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-bold leading-snug">{v.title}</span>
                  <SalaryText from={v.salary_from} to={v.salary_to} type={v.salary_type} negotiable={v.salary_negotiable} className="block truncate text-sm font-bold text-primary" />
                  <span className="block truncate text-sm text-muted-foreground">
                    {place}
                    {v.company_name ? ` · ${v.company_name}` : ""}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
