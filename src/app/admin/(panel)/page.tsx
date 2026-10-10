import type { Metadata } from "next";
import Link from "next/link";
import { Users, UserSearch, Building2, BadgeCheck, Briefcase, Clock, FileText, Handshake, UserPlus, Flag, ShieldCheck, Activity, ArrowRight } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getAdminContext } from "@/features/admin/context";
import { getAdminStats, getDailyStats, getSidebarCounts, sumDaily } from "@/features/admin/queries/dashboard";
import { parseDays, type SearchParams } from "@/features/admin/queries/shared";
import { StatTile } from "@/features/admin/components/stat-tile";
import { DailyCharts, DaysToggle } from "@/features/admin/components/daily-charts";
import { AdminPageHeader, Forbidden, QueryError } from "@/features/admin/components/notes";
import { Button } from "@/components/ui/button";
import { listSettings } from "@/features/admin/queries/settings";
import { getAiStatus } from "@/features/admin/queries/ai-status";
import { QuickControls, type QuickControl } from "@/features/admin/components/quick-controls";
import { AiStatusCard } from "@/features/admin/components/ai-status-card";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.dashboard")} · ${t("admin.shell.title")}` };
}

export default async function AdminDashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getAdminContext();
  const { t } = await getT();
  if (!ctx.can("analytics.view")) return <Forbidden perm="analytics.view" />;
  const sp = await searchParams;
  const days = parseDays(sp, 30);
  const [{ stats, error }, daily, counts, settings, ai] = await Promise.all([getAdminStats(), getDailyStats(days), getSidebarCounts(), listSettings(), getAiStatus()]);
  const totals = sumDaily(daily.rows);

  // Tezkor boshqaruv: eng kerakli sozlamalar oddiy tilda (qolganlari — Sozlamalar sahifasida)
  const setting = (key: string) => settings.rows.find((r) => r.key === key);
  const quick: QuickControl[] = [
    { key: "ai_alerts_paid", kind: "boolean" as const, label: t("admin.quick.ai_paid"), hint: t("admin.quick.ai_paid_hint"), onText: t("admin.quick.paid"), offText: t("admin.quick.free") },
    { key: "price_ai_alerts", kind: "number" as const, label: t("admin.quick.ai_price"), hint: t("admin.quick.ai_price_hint"), suffix: t("admin.quick.sum_month") },
    { key: "listings_paid", kind: "boolean" as const, label: t("admin.quick.listings_paid"), hint: t("admin.quick.listings_paid_hint"), onText: t("admin.quick.paid"), offText: t("admin.quick.free") },
    { key: "employer_verification_required", kind: "boolean" as const, label: t("admin.quick.employer_check"), hint: t("admin.quick.employer_check_hint") },
  ].flatMap((c) => {
    const row = setting(c.key);
    if (!row || (c.kind === "boolean" ? typeof row.value !== "boolean" : typeof row.value !== "number")) return [];
    return [{ ...c, value: row.value as boolean | number, isPublic: row.is_public }];
  });

  const queues = [
    { href: "/admin/vacancies?status=pending_review", label: t("admin.dashboard.queue_vacancies"), count: counts.vacancies, perm: ctx.can("vacancies.view") },
    { href: "/admin/reports?status=open", label: t("admin.dashboard.queue_reports"), count: counts.reports, perm: ctx.can("reports.view") },
    { href: "/admin/verifications", label: t("admin.dashboard.queue_verifications"), count: counts.verifications, perm: ctx.can("employers.verify") },
    { href: "/admin/reviews?status=pending", label: t("admin.dashboard.queue_reviews"), count: counts.reviews, perm: true },
  ].filter((q) => q.perm);

  return (
    <div>
      <AdminPageHeader title={t("admin.dashboard.title")} subtitle={t("admin.dashboard.subtitle")} />
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {quick.length ? <QuickControls items={quick} canManage={ctx.can("settings.manage")} /> : <QueryError message={settings.error} />}
        <AiStatusCard status={ai} canTest={ctx.can("settings.manage")} />
      </div>
      <QueryError message={error} />
      {stats ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatTile label={t("admin.stats.total_users")} value={stats.total_users} icon={<Users />} tone="primary" href={ctx.can("users.view") ? "/admin/users" : undefined} hint={t("admin.stats.new_7d", { count: stats.new_registrations_7d })} />
            <StatTile label={t("admin.stats.workers")} value={stats.workers} icon={<UserSearch />} href={ctx.can("workers.view") ? "/admin/workers" : undefined} />
            <StatTile label={t("admin.stats.employers")} value={stats.employers} icon={<Building2 />} href={ctx.can("employers.view") ? "/admin/employers" : undefined} hint={t("admin.stats.verified_count", { count: stats.verified_employers })} />
            <StatTile label={t("admin.stats.active_vacancies")} value={stats.active_vacancies} icon={<Briefcase />} tone="success" href={ctx.can("vacancies.view") ? "/admin/vacancies?status=active" : undefined} />
            <StatTile label={t("admin.stats.pending_vacancies")} value={stats.pending_vacancies} icon={<Clock />} tone="warning" href={ctx.can("vacancies.view") ? "/admin/vacancies?status=pending_review" : undefined} />
            <StatTile label={t("admin.stats.applications")} value={stats.applications} icon={<FileText />} />
            <StatTile label={t("admin.stats.hires")} value={stats.hires} icon={<Handshake />} tone="success" />
            <StatTile label={t("admin.stats.new_registrations_7d")} value={stats.new_registrations_7d} icon={<UserPlus />} />
            <StatTile label={t("admin.stats.open_reports")} value={stats.open_reports} icon={<Flag />} tone="destructive" href={ctx.can("reports.view") ? "/admin/reports" : undefined} />
            <StatTile label={t("admin.stats.pending_verifications")} value={stats.pending_verifications} icon={<ShieldCheck />} tone="warning" href={ctx.can("employers.verify") ? "/admin/verifications" : undefined} />
            <StatTile label={t("admin.stats.dau")} value={stats.dau} icon={<Activity />} hint={t("admin.stats.wau_mau", { wau: stats.wau, mau: stats.mau })} />
            <StatTile label={t("admin.stats.verified_employers")} value={stats.verified_employers} icon={<BadgeCheck />} tone="success" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_300px]">
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold">{t("admin.dashboard.charts_title")}</h2>
                <DaysToggle base="/admin" days={days} />
              </div>
              <QueryError message={daily.error} />
              <DailyCharts rows={daily.rows} totals={totals} />
            </section>
            <aside>
              <h2 className="mb-3 text-base font-semibold">{t("admin.dashboard.queues_title")}</h2>
              <ul className="space-y-2">
                {queues.map((q) => (
                  <li key={q.href}>
                    <Link href={q.href} className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-card px-4 py-3 text-sm font-medium shadow-sm transition-colors hover:bg-secondary/50">
                      <span>{q.label}</span>
                      <span className="flex items-center gap-2">
                        <span className={q.count ? "rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-white tabular" : "text-xs text-muted-foreground"}>{q.count}</span>
                        <ArrowRight className="size-4 text-muted-foreground" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                <Link href={`/admin/analytics?days=${days}`}>{t("admin.dashboard.open_analytics")}</Link>
              </Button>
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}
