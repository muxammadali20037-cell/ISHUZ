import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { getAdminContext } from "@/features/admin/context";
import { AdminPageHeader, Forbidden, QueryError } from "@/features/admin/components/notes";
import { DaysToggle } from "@/features/admin/components/daily-charts";
import { DailyBarChart } from "@/features/admin/components/charts";
import { parseDays, type SearchParams } from "@/features/admin/queries/shared";
import { revenueReport, revenueSince, type RevenuePayment } from "@/features/admin/revenue";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";

/** hisobot oralig'idagi to'lovlar (Payme/Click; hamyon — ichki) — hali kam, xavfsiz chegara bilan */
const REPORT_LIMIT = 5000;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.payments")} · ${t("admin.shell.title")}` };
}

/**
 * To'lovlar: kunlik daromad hisoboti (7/30/90 kun, Toshkent vaqti — ega, 2026-11-27: "admin panelda kunlik daromad va
 * to'lovlar hisoboti") va oxirgi 200 ta to'lov (RLS: settings.manage ruxsati)
 */
export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getAdminContext();
  if (!ctx.can("settings.manage")) return <Forbidden perm="settings.manage" />;
  const { t, locale } = await getT();
  const days = parseDays(await searchParams, 30);
  const now = new Date();
  const since = revenueSince(days, now);
  const supabase = await createClient();
  const [recent, period] = await Promise.all([
    supabase.from("payments").select("id, order_no, purpose, amount, status, provider, created_at, paid_at").order("created_at", { ascending: false }).limit(200),
    supabase
      .from("payments")
      .select("amount, purpose, provider, status, paid_at, cancelled_at")
      .not("paid_at", "is", null)
      .or(`paid_at.gte.${since},cancelled_at.gte.${since}`)
      .order("paid_at", { ascending: false })
      .limit(REPORT_LIMIT),
  ]);
  const rows = recent.data ?? [];
  const periodRows = (period.data ?? []) as RevenuePayment[];
  const report = revenueReport(periodRows, days, now);
  const money = (n: number) => formatMoney(n, locale);
  const pending = rows.filter((r) => r.status === "pending").length;
  const stats = [
    { key: "net", label: t("admin.payments.report.net"), value: money(report.totals.net), hint: report.totals.refunds ? t("admin.payments.report.refunds_hint", { amount: money(report.totals.refunds) }) : null },
    { key: "count", label: t("admin.payments.count_paid"), value: report.totals.count.toLocaleString("ru-RU"), hint: pending ? t("admin.payments.report.pending_hint", { count: pending }) : null },
    { key: "average", label: t("admin.payments.report.average"), value: report.totals.count ? money(report.totals.average) : "—", hint: null },
    { key: "today", label: t("admin.payments.report.today"), value: money(report.totals.today), hint: null },
  ];
  const active = [...report.days].reverse().filter((d) => d.count || d.refunds);
  const tone = { paid: "success", pending: "warning", cancelled: "default", failed: "destructive" } as const;

  return (
    <div>
      <AdminPageHeader title={t("admin.payments.title")} subtitle={t("admin.payments.subtitle")} />
      <QueryError message={recent.error?.message ?? period.error?.message ?? null} />

      <section className="mb-6 space-y-4" data-revenue-report>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{t("admin.payments.report.title")}</h2>
          <DaysToggle base="/admin/payments" days={days} />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.key} className="rounded-2xl border border-border bg-card p-4" data-revenue-stat={s.key}>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-xl font-bold tabular">{s.value}</p>
              {s.hint ? <p className="mt-0.5 text-xs text-muted-foreground">{s.hint}</p> : null}
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 text-sm font-semibold">{t("admin.payments.report.chart", { days })}</p>
          <DailyBarChart data={report.days.map((d) => ({ day: d.day, value: d.revenue - d.refunds }))} label={t("admin.payments.report.chart", { days })} locale={locale} tone="success" />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {(
            [
              ["purpose", report.byPurpose.map((x) => ({ key: x.purpose, label: t(`admin.payments.purposes.${x.purpose}`), amount: x.amount, count: x.count }))],
              ["provider", report.byProvider.map((x) => ({ key: x.provider, label: x.provider === "payme" ? "Payme" : x.provider === "click" ? "Click" : x.provider, amount: x.amount, count: x.count }))],
            ] as const
          ).map(([kind, items]) => (
            <div key={kind} className="rounded-2xl border border-border bg-card p-4" data-revenue-by={kind}>
              <p className="mb-2 text-sm font-semibold">{t(`admin.payments.report.by_${kind}`)}</p>
              {items.length ? (
                <ul className="space-y-2">
                  {items.map((x) => (
                    <li key={x.key} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        {x.label} <span className="text-muted-foreground">· {t("admin.payments.report.times", { count: x.count })}</span>
                      </span>
                      <span className="font-semibold tabular">{money(x.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t("admin.payments.report.none")}</p>
              )}
            </div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-2xl border border-border bg-card" data-revenue-days>
          <p className="px-4 pt-3 text-sm font-semibold">{t("admin.payments.report.by_day")}</p>
          {active.length ? (
            <table className="mt-2 w-full text-sm">
              <thead className="bg-secondary/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium whitespace-nowrap">{t("admin.payments.date")}</th>
                  <th className="px-4 py-2 font-medium whitespace-nowrap">{t("admin.payments.count_paid")}</th>
                  <th className="hidden px-4 py-2 font-medium whitespace-nowrap sm:table-cell">{t("admin.payments.report.revenue")}</th>
                  <th className="hidden px-4 py-2 font-medium whitespace-nowrap sm:table-cell">{t("admin.payments.report.refunds")}</th>
                  <th className="px-4 py-2 font-medium whitespace-nowrap">{t("admin.payments.report.net")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {active.map((d) => (
                  <tr key={d.day} data-revenue-day={d.day}>
                    {/* telefonda ham bir qatorda: qisqa sana (27.11), summa bo'linmaydi */}
                    <td className="px-4 py-2 whitespace-nowrap tabular" title={formatDate(`${d.day}T12:00:00+05:00`, locale)}>{`${d.day.slice(8)}.${d.day.slice(5, 7)}`}</td>
                    <td className="px-4 py-2 tabular">{d.count}</td>
                    <td className="hidden px-4 py-2 whitespace-nowrap tabular sm:table-cell">{money(d.revenue)}</td>
                    <td className="hidden px-4 py-2 whitespace-nowrap tabular text-muted-foreground sm:table-cell">{d.refunds ? `−${money(d.refunds)}` : "—"}</td>
                    <td className="px-4 py-2 whitespace-nowrap font-semibold tabular">
                      {money(d.revenue - d.refunds)}
                      {/* telefonda ustunlar kam: qaytarilgani sof tushum ostida */}
                      {d.refunds ? <span className="block text-xs font-normal text-muted-foreground sm:hidden">{t("admin.payments.report.refunds_hint", { amount: `−${money(d.refunds)}` })}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-4 pb-4 pt-1 text-sm text-muted-foreground">{t("admin.payments.report.none_days", { days })}</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("admin.payments.total_note")}</p>
      </section>

      <h2 className="mb-3 text-lg font-bold">{t("admin.payments.report.recent")}</h2>
      {rows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs text-muted-foreground">
              <tr>
                {["order", "purpose", "amount", "provider", "status", "date"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-medium">
                    {t(`admin.payments.${h}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5 font-mono tabular">#{r.order_no}</td>
                  <td className="px-4 py-2.5">{t(`admin.payments.purposes.${r.purpose}`)}</td>
                  <td className="px-4 py-2.5 font-semibold tabular">{formatMoney(r.amount, locale)}</td>
                  <td className="px-4 py-2.5 capitalize">{r.provider === "wallet" ? t("admin.payments.providers.wallet") : (r.provider ?? "—")}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={tone[r.status]} size="sm">
                      {t(`admin.payments.statuses.${r.status}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{formatDateTime(r.paid_at ?? r.created_at, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={t("common.empty.nothing_here")} />
      )}
    </div>
  );
}
