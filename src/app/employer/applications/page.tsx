import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck2, Eye, Inbox, UserCheck, type LucideIcon } from "lucide-react";
import { requireEmployer } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { Shell } from "@/components/shared/shell";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { getApplicationStageCounts } from "@/features/employer/queries";
import { RecentApplicationsSection } from "@/features/employer/components/dashboard/recent-applications-section";
import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database.types";

type Status = Enums<"application_status">;
const STATUSES: Status[] = ["sent", "viewed", "shortlisted", "interview", "offered", "hired", "rejected", "withdrawn"];

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("employer.sections.applications"), robots: { index: false } };
}

/**
 * /employer/applications — kompaniyaga kelgan barcha arizalar (2026-11 redizayn, "Hiring Flow" uslubi): bosqich kartalari
 * (haqiqiy sonlar va jami arizalardagi ulushi), holat bo'yicha filtr (?holat=…, sonlari bilan) va jadval (nomzod · vakansiya ·
 * sana · bosqich). Soxta "AI ball" yo'q: moslik faqat hisoblangan bo'lsa (ariza qatoridagi belgi).
 */
export default async function EmployerApplicationsPage({ searchParams }: { searchParams: Promise<{ holat?: string }> }) {
  const session = await requireEmployer("/employer/applications");
  const [{ t, tEnum }, sp] = await Promise.all([getT(), searchParams]);
  const counts = await getApplicationStageCounts(session.userId, session.companyId);
  const total = counts ? Object.values(counts).reduce((a, b) => a + (b ?? 0), 0) : 0;
  const status = STATUSES.find((s) => s === sp.holat) ?? null;
  const n = (...s: Status[]) => s.reduce((a, k) => a + (counts?.[k] ?? 0), 0);
  const stages: { key: string; icon: LucideIcon; label: string; value: number; tone: string; bar: string }[] = [
    { key: "new", icon: Inbox, label: t("employer.pipeline.stage_new"), value: n("sent"), tone: "bg-primary text-primary-foreground", bar: "bg-primary" },
    { key: "review", icon: Eye, label: t("employer.pipeline.stage_review"), value: n("viewed", "shortlisted"), tone: "bg-info-soft text-info", bar: "bg-info" },
    { key: "interview", icon: CalendarCheck2, label: t("employer.pipeline.stage_interview"), value: n("interview", "offered"), tone: "bg-warning-soft text-warning", bar: "bg-warning" },
    { key: "hired", icon: UserCheck, label: t("employer.pipeline.stage_hired"), value: n("hired"), tone: "bg-success-soft text-success", bar: "bg-success" },
  ];
  const chip = (on: boolean) =>
    cn(
      "press inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-semibold",
      on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/50 hover:text-primary-ink",
    );
  return (
    <Shell forceRole="employer">
      <div className="container-app space-y-5 py-5 sm:py-8">
        <PageHeader title={t("employer.sections.applications")} subtitle={total ? t("employer.pipeline.total", { count: total }) : t("employer.sections.applications_desc")} />
        {total ? (
          <>
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {stages.map((s) => (
                <li key={s.key} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug text-muted-foreground">{s.label}</p>
                      <p className="tabular mt-1 text-2xl font-extrabold leading-none">{s.value}</p>
                    </div>
                    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-10", s.tone)} aria-hidden>
                      <s.icon className="size-5" />
                    </span>
                  </div>
                  {/* jami arizalardagi ulushi */}
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                    <div className={cn("h-full rounded-full", s.bar)} style={{ width: `${Math.round((s.value / total) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <nav aria-label={t("employer.pipeline.filters_label")} className="-mx-4 sm:mx-0">
              <ul className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
                <li className="flex">
                  <Link href="/employer/applications" scroll={false} aria-current={status ? undefined : "page"} className={chip(!status)}>
                    {t("employer.pipeline.filter_all")} <span className="tabular opacity-80">{total}</span>
                  </Link>
                </li>
                {STATUSES.filter((s) => (counts?.[s] ?? 0) > 0 || s === status).map((s) => (
                  <li key={s} className="flex">
                    <Link href={`/employer/applications?holat=${s}`} scroll={false} aria-current={status === s ? "page" : undefined} className={chip(status === s)}>
                      {tEnum("application_status", s)} <span className="tabular opacity-80">{counts?.[s] ?? 0}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <RecentApplicationsSection userId={session.userId} companyId={session.companyId} limit={100} status={status} bare title={t("employer.sections.applications_all")} />
          </>
        ) : (
          <EmptyState icon={Inbox} title={t("employer.sections.applications_empty")} description={t("employer.sections.applications_empty_desc")} />
        )}
      </div>
    </Shell>
  );
}
