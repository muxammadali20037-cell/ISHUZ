import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { formatDate } from "@/lib/format";
import { getAdminContext } from "@/features/admin/context";
import { DAILY_METRICS, getAdminStats, getDailyStats, sumDaily } from "@/features/admin/queries/dashboard";
import { parseDays, type SearchParams } from "@/features/admin/queries/shared";
import { DailyCharts, DaysToggle } from "@/features/admin/components/daily-charts";
import { DataTable } from "@/features/admin/components/data-table";
import { StatTile } from "@/features/admin/components/stat-tile";
import { AdminPageHeader, Forbidden, QueryError } from "@/features/admin/components/notes";
import { EmptyState } from "@/components/ui/misc";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.analytics")} · ${t("admin.shell.title")}` };
}

export default async function AdminAnalyticsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getAdminContext();
  const { t, locale } = await getT();
  if (!ctx.can("analytics.view")) return <Forbidden perm="analytics.view" />;
  const sp = await searchParams;
  const days = parseDays(sp, 30);
  const [daily, { stats }] = await Promise.all([getDailyStats(days), getAdminStats()]);
  const totals = sumDaily(daily.rows);
  const rows = [...daily.rows].reverse();

  return (
    <div>
      <AdminPageHeader title={t("admin.analytics.title")} subtitle={t("admin.analytics.subtitle")} actions={<DaysToggle base="/admin/analytics" days={days} />} />
      <QueryError message={daily.error} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {DAILY_METRICS.map((m) => (
          <StatTile key={m} label={`${t(`admin.metrics.${m}`)} · ${t("admin.analytics.last_days", { days })}`} value={totals[m]} />
        ))}
      </div>
      {stats ? (
        <div className="mb-5 grid grid-cols-3 gap-3">
          <StatTile label={t("admin.stats.dau")} value={stats.dau} />
          <StatTile label={t("admin.stats.wau")} value={stats.wau} />
          <StatTile label={t("admin.stats.mau")} value={stats.mau} />
        </div>
      ) : null}
      <DailyCharts rows={daily.rows} totals={totals} />
      <h2 className="mb-3 mt-6 text-base font-semibold">{t("admin.analytics.table_title")}</h2>
      <DataTable
        rows={rows}
        rowKey={(r) => r.day}
        empty={<EmptyState title={t("common.empty.nothing_here")} />}
        columns={[
          { key: "day", header: t("admin.analytics.day"), render: (r) => formatDate(r.day, locale, "d MMM yyyy") },
          ...DAILY_METRICS.map((m) => ({ key: m, header: t(`admin.metrics.${m}`), align: "right" as const, render: (r: (typeof rows)[number]) => r[m].toLocaleString("ru-RU") })),
        ]}
      />
    </div>
  );
}
