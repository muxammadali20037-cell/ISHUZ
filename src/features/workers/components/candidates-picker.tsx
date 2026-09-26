import Link from "next/link";
import { Briefcase, ChevronRight, Users } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatRelative } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import type { Enums } from "@/types/database.types";
import type { MyVacancy } from "../types";

const tone: Partial<Record<Enums<"vacancy_status">, "success" | "warning" | "default" | "destructive">> = {
  active: "success",
  paused: "warning",
  pending_review: "warning",
  draft: "default",
  closed: "default",
  expired: "default",
  hidden: "destructive",
  rejected: "destructive",
};

/** /employer/candidates: faol vakansiya bo'lmasa — vakansiyani tanlash yoki yangisini joylash */
export async function CandidatesPicker({ vacancies }: { vacancies: MyVacancy[] }) {
  const { t, tEnum, locale } = await getT();
  return (
    <div className="container-app py-4 md:py-6">
      <PageHeader title={t("workers.candidates.title")} subtitle={t("workers.candidates.desc")} backHref="/employer" />
      {!vacancies.length ? (
        <EmptyState icon={Briefcase} title={t("workers.candidates.empty_title")} description={t("workers.candidates.empty_desc")} action={{ label: t("workers.candidates.post"), href: "/employer/vacancies/new" }} />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">{t("workers.candidates.no_active_hint")}</p>
          <ul className="space-y-2">
            {vacancies.map((v) => (
              <li key={v.id}>
                <Link href={`/workers?vacancy=${v.id}`} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 transition-shadow hover:shadow-md">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Briefcase className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{v.title}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={tone[v.status] ?? "default"} size="sm">
                        {tEnum("vacancy_status", v.status)}
                      </Badge>
                      {formatRelative(v.published_at ?? v.created_at, locale)}
                    </p>
                  </div>
                  <span className="hidden text-sm font-medium text-primary sm:inline">{t("workers.candidates.view_candidates")}</span>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button asChild>
              <Link href="/employer/vacancies/new">{t("workers.candidates.post")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/workers">
                <Users className="size-4" /> {t("workers.candidates.search_all")}
              </Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
