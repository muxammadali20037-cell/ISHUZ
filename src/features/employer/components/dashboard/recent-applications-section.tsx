import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatRelative, fullName, initials } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { SectionHeader } from "@/components/ui/misc";
import { MatchScore } from "@/components/shared/match-score";
import { getRecentApplications } from "../../queries";
import { ApplicationStatusBadge } from "./status-badge";
import type { Enums } from "@/types/database.types";

/**
 * Yangi arizalar (2026-10): kompyuterda jadval (nomzod · vakansiya · sana · holat), telefonda ixcham qatorlar.
 * Har qator → /employer/vacancies/[vacancyId]/applications.
 */
export async function RecentApplicationsSection({
  userId,
  companyId,
  limit = 5,
  title,
  status,
  bare = false,
}: {
  userId: string;
  companyId: string | null;
  limit?: number;
  title?: string;
  /** faqat shu holatdagi arizalar (/employer/applications filtri) */
  status?: Enums<"application_status"> | null;
  /** sarlavhasiz (sahifaning o'zida sarlavha va filtrlar bor) */
  bare?: boolean;
}) {
  const { t, tEnum, locale } = await getT();
  const apps = await getRecentApplications(userId, companyId, limit, status);
  if (!apps.length) return bare ? <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-muted-foreground">{t("employer.pipeline.filter_empty")}</p> : null;
  const heading = title ?? t("employer.dashboard.recent_applications");
  const rows = apps.map((a) => ({ ...a, name: fullName(a.first_name, a.last_name) || t("employer.dashboard.unknown_candidate"), href: `/employer/vacancies/${a.vacancy_id}/applications` }));
  return (
    <section aria-label={heading}>
      {bare ? null : <SectionHeader title={heading} href="/employer/applications" linkLabel={t("employer.dashboard.all")} />}
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card md:hidden">
        {rows.map((a) => (
          <li key={a.id}>
            <Link href={a.href} className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/60">
              <Avatar src={a.avatar_url} fallback={initials(a.first_name, a.last_name)} size="sm" alt="" />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-semibold">{a.name}</span>
                  <MatchScore score={a.match_score} size="sm" />
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {a.vacancy_title} · {formatRelative(a.created_at, locale)}
                </p>
              </div>
              <ApplicationStatusBadge status={a.status} label={tEnum("application_status", a.status)} />
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-5 py-3 font-semibold">{t("employer.dashboard.col_candidate")}</th>
              <th scope="col" className="px-5 py-3 font-semibold">{t("employer.dashboard.col_vacancy")}</th>
              <th scope="col" className="px-5 py-3 font-semibold">{t("employer.dashboard.col_date")}</th>
              <th scope="col" className="px-5 py-3 font-semibold">{t("employer.dashboard.col_status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((a) => (
              <tr key={a.id} className="relative transition-colors hover:bg-secondary/60">
                <td className="max-w-0 px-5 py-3">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar src={a.avatar_url} fallback={initials(a.first_name, a.last_name)} size="sm" alt="" />
                    <Link href={a.href} className="truncate text-base font-semibold after:absolute after:inset-0 after:content-[''] hover:text-primary-ink">
                      {a.name}
                    </Link>
                    <MatchScore score={a.match_score} size="sm" />
                  </span>
                </td>
                <td className="max-w-0 truncate px-5 py-3">{a.vacancy_title}</td>
                <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{formatRelative(a.created_at, locale)}</td>
                <td className="px-5 py-3">
                  <ApplicationStatusBadge status={a.status} label={tEnum("application_status", a.status)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
