import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, MessageSquare } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatDateTime, formatRelative, fullName } from "@/lib/format";
import { getAdminContext } from "@/features/admin/context";
import { listReports, parseReportFilters, reportStatusCounts, REPORT_STATUSES } from "@/features/admin/queries/moderation";
import type { SearchParams } from "@/features/admin/queries/shared";
import { withParam } from "@/features/admin/url";
import { DataTable } from "@/features/admin/components/data-table";
import { LinkTabs } from "@/features/admin/components/link-tabs";
import { Pagination } from "@/features/admin/components/pagination";
import { AdminPageHeader, Forbidden, QueryError } from "@/features/admin/components/notes";
import { StatusBadge } from "@/features/admin/components/status-badge";
import { ReportActions } from "@/features/admin/components/report-actions";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.reports")} · ${t("admin.shell.title")}` };
}

const BASE = "/admin/reports";

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getAdminContext();
  const { t, tEnum, locale } = await getT();
  if (!ctx.can("reports.view")) return <Forbidden perm="reports.view" />;
  const sp = await searchParams;
  const f = parseReportFilters(sp);
  const [paged, counts] = await Promise.all([listReports(f), reportStatusCounts()]);
  const canResolve = ctx.can("reports.resolve");
  const canBlock = ctx.can("users.block");
  const canModerate = ctx.can("vacancies.moderate");

  return (
    <div>
      <AdminPageHeader title={t("admin.reports.title")} subtitle={t("admin.reports.subtitle")} />
      <LinkTabs tabs={REPORT_STATUSES.map((s) => ({ href: withParam(BASE, {}, "status", s), label: tEnum("report_status", s), count: counts[s], active: f.status === s }))} />
      <QueryError message={paged.error} />
      <DataTable
        rows={paged.rows}
        rowKey={(r) => r.id}
        empty={<EmptyState title={t("admin.reports.empty")} />}
        columns={[
          {
            key: "reason",
            header: t("admin.reports.col_reason"),
            render: (r) => (
              <div className="max-w-[260px]">
                <Badge variant={r.reason === "fraud" || r.reason === "asked_money" ? "destructive" : "warning"} size="sm">{tEnum("report_reason", r.reason)}</Badge>
                {r.details ? <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground line-clamp-3" title={r.details}>{r.details}</p> : null}
                {r.resolution_note ? <p className="mt-1 text-xs"><span className="font-medium">{t("admin.reports.resolution_note")}:</span> {r.resolution_note}</p> : null}
              </div>
            ),
          },
          {
            key: "target",
            header: t("admin.reports.col_target"),
            render: (r) => (
              <div className="max-w-[240px]">
                <Badge variant="outline" size="sm">{t(`admin.reports.target_${r.target_type}`)}</Badge>
                <div className="mt-1 text-sm">
                  {r.target.href ? (
                    <Link href={r.target.href} target={r.target.href.startsWith("/admin") ? undefined : "_blank"} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                      <span className="truncate">{r.target.label ?? r.target.id.slice(0, 12)}</span>
                      <ExternalLink className="size-3 shrink-0" />
                    </Link>
                  ) : r.target.type === "message" ? (
                    <div className="text-xs">
                      <p className="inline-flex items-center gap-1 text-muted-foreground"><MessageSquare className="size-3.5" /> {t("admin.reports.message_id")} {r.target.id}</p>
                      {r.target.message ? (
                        <p className="mt-1 rounded-lg bg-secondary/70 p-2 text-foreground">
                          <span className="font-medium">{r.target.label}:</span> {r.target.message.body ?? tEnum("notification_type", "new_message")}
                          <span className="block text-[11px] text-muted-foreground">{t("admin.reports.conversation")} {r.target.message.conversation_id.slice(0, 8)} · {formatDateTime(r.target.message.created_at, locale)}</span>
                        </p>
                      ) : (
                        <p className="mt-0.5 text-muted-foreground">{t("admin.reports.message_hidden")}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">{r.target.id}</span>
                  )}
                </div>
                {r.target.profileBlocked ? <Badge variant="destructive" size="sm" className="mt-1">{t("admin.users.blocked")}</Badge> : null}
                {r.target.vacancyStatus ? <StatusBadge status={r.target.vacancyStatus} label={tEnum("vacancy_status", r.target.vacancyStatus)} size="sm" /> : null}
              </div>
            ),
          },
          {
            key: "reporter",
            header: t("admin.reports.col_reporter"),
            render: (r) =>
              r.reporter ? (
                <Link href={`/admin/users?q=${r.reporter.id}`} className="hover:underline">{fullName(r.reporter.first_name, r.reporter.last_name) || r.reporter.id.slice(0, 8)}</Link>
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
          {
            key: "created",
            header: t("admin.users.col_created"),
            render: (r) => (
              <div className="text-xs">
                <p title={formatDateTime(r.created_at, locale)}>{formatRelative(r.created_at, locale)}</p>
                {r.resolver ? <p className="text-muted-foreground">{t("admin.reports.by", { name: fullName(r.resolver.first_name, r.resolver.last_name) })}</p> : null}
              </div>
            ),
          },
          { key: "status", header: t("admin.vacancies.col_status"), render: (r) => <StatusBadge status={r.status} label={tEnum("report_status", r.status)} size="sm" /> },
          {
            key: "actions",
            header: "",
            align: "right",
            className: "min-w-[260px]",
            render: (r) => <ReportActions reportId={r.id} status={r.status} canResolve={canResolve} canBlock={canBlock} canModerate={canModerate} target={r.target} />,
          },
        ]}
      />
      <Pagination paged={paged} base={BASE} searchParams={sp} />
    </div>
  );
}
