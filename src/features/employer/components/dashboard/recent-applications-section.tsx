import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatRelative, fullName, initials } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { SectionHeader } from "@/components/ui/misc";
import { MatchScore } from "@/components/shared/match-score";
import { getRecentApplications } from "../../queries";
import { ApplicationStatusBadge } from "./status-badge";

/** So'nggi 5 ta ariza → /employer/vacancies/[vacancyId]/applications */
export async function RecentApplicationsSection({ userId, companyId }: { userId: string; companyId: string | null }) {
  const { t, tEnum, locale } = await getT();
  const apps = await getRecentApplications(userId, companyId, 5);
  if (!apps.length) return null;
  return (
    <section className="mt-8">
      <SectionHeader title={t("employer.dashboard.recent_applications")} href="/employer/candidates" linkLabel={t("employer.dashboard.all")} />
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        {apps.map((a) => {
          const name = fullName(a.first_name, a.last_name) || t("employer.dashboard.unknown_candidate");
          return (
            <li key={a.id}>
              <Link href={`/employer/vacancies/${a.vacancy_id}/applications`} className="flex items-center gap-3 p-4 transition-colors hover:bg-secondary/60">
                <Avatar src={a.avatar_url} fallback={initials(a.first_name, a.last_name)} size="md" alt="" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold">{name}</span>
                    <MatchScore score={a.match_score} size="sm" />
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {a.vacancy_title} · {formatRelative(a.created_at, locale)}
                  </p>
                </div>
                <ApplicationStatusBadge status={a.status} label={tEnum("application_status", a.status)} />
                <ChevronRight className="hidden size-5 shrink-0 text-muted-foreground sm:block" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
