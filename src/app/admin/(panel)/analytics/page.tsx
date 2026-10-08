import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getAdminContext } from "@/features/admin/context";
import { resolvePeriod } from "@/features/admin/period";
import { SERIES_METRICS, getStatsSeries, getStatsV2 } from "@/features/admin/queries/panel";
import { param, type SearchParams } from "@/features/admin/queries/shared";
import { DailyBarChart } from "@/features/admin/components/charts";
import { LinkTabs } from "@/features/admin/components/link-tabs";
import { StatTile } from "@/features/admin/components/stat-tile";
import { AdminPageHeader, Forbidden, QueryError } from "@/features/admin/components/notes";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.analytics")} · ${t("admin.shell.title")}` };
}

const BASE = "/admin/analytics";
const FUNNEL = ["home_view", "direction_select", "post_start", "post_review", "post_publish", "contact_click", "outcome_report"] as const;
const CHARTS: { key: (typeof SERIES_METRICS)[number]; tone: "primary" | "success" | "warning" }[] = [
  { key: "users_new", tone: "primary" },
  { key: "published", tone: "success" },
  { key: "rejected", tone: "warning" },
  { key: "searches", tone: "primary" },
  { key: "searches_zero", tone: "warning" },
  { key: "contact_clicks", tone: "primary" },
  { key: "tg_sent", tone: "success" },
  { key: "outcomes", tone: "success" },
];

const num = (n: number | null | undefined) => (n ?? 0).toLocaleString("ru-RU");

/**
 * Statistika: faqat haqiqiy ma'lumot, davr Toshkent vaqtida (Bugun / 7 / 30 / tanlangan).
 * Qo'ng'iroq tugmasi bosilishi ishga olish emas; Telegram'da yetkazilgan xabar "o'qilgan" emas —
 * ochilish faqat kuzatiladigan havola (/r/...) orqali hisoblanadi.
 */
export default async function AdminAnalyticsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getAdminContext();
  const { t, locale } = await getT();
  if (!ctx.can("analytics.view")) return <Forbidden perm="analytics.view" />;
  const sp = await searchParams;
  const period = resolvePeriod(param(sp, "period"), param(sp, "from"), param(sp, "to"));
  const [{ stats, error }, series] = await Promise.all([getStatsV2(period.from, period.to), getStatsSeries(period.from, period.to)]);
  const q = (k: string) => (k === "custom" ? `${BASE}?period=custom&from=${period.fromDay}&to=${period.toDay}` : k === "30" ? BASE : `${BASE}?period=${k}`);
  const exportHref = (kind: "series" | "summary") => `${BASE}/export?kind=${kind}&period=custom&from=${period.fromDay}&to=${period.toDay}`;
  const name = (r: { name_uz: string; name_ru: string }) => (locale === "ru" ? r.name_ru : r.name_uz);
  const funnelTop = Math.max(1, stats?.funnel?.home_view ?? 0);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t("admin.analytics.title")}
        subtitle={t("admin.analytics.period_label", { from: period.fromDay, to: period.toDay })}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <a href={exportHref("summary")}>
                <Download className="size-4" /> {t("admin.analytics.export_summary")}
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={exportHref("series")}>
                <Download className="size-4" /> {t("admin.analytics.export_series")}
              </a>
            </Button>
          </div>
        }
      />
      <div className="flex flex-wrap items-end gap-3">
        <LinkTabs className="mb-0 w-fit" tabs={(["today", "7", "30"] as const).map((k) => ({ href: q(k), label: t(`admin.analytics.periods.${k}`), active: period.kind === k }))} />
        <form action={BASE} className="flex flex-wrap items-end gap-2 text-sm">
          <input type="hidden" name="period" value="custom" />
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t("admin.analytics.from")}</span>
            <input type="date" name="from" defaultValue={period.fromDay} className="h-9 rounded-lg border border-input bg-card px-2" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t("admin.analytics.to")}</span>
            <input type="date" name="to" defaultValue={period.toDay} className="h-9 rounded-lg border border-input bg-card px-2" />
          </label>
          <Button type="submit" size="sm" variant={period.kind === "custom" ? "default" : "outline"}>
            {t("admin.analytics.apply")}
          </Button>
        </form>
      </div>
      <QueryError message={error ?? series.error} />

      {stats ? (
        <>
          <section>
            <h2 className="mb-3 text-base font-semibold">{t("admin.analytics.sections.people")}</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile label={t("admin.analytics.m.users_total")} value={stats.users_total} />
              <StatTile label={t("admin.analytics.m.users_new")} value={stats.users_new} tone="primary" />
              <StatTile label={t("admin.analytics.m.workers_active")} value={stats.workers_active} />
              <StatTile label={t("admin.analytics.m.employers_active")} value={stats.employers_active} />
              <StatTile label={t("admin.analytics.m.vacancies_active")} value={stats.vacancies_active} />
              <StatTile label={t("admin.analytics.m.employers_pending")} value={stats.employers_pending} tone={stats.employers_pending ? "warning" : "default"} href="/admin/verifications" />
              <StatTile label={t("admin.analytics.m.employers_verified")} value={stats.employers_verified} tone="success" />
              <StatTile label={t("admin.analytics.m.moderation_queue")} value={`${num(stats.moderation_pending)} / ${num(stats.moderation_review)}`} hint={t("admin.analytics.m.moderation_queue_hint")} href="/admin/moderation" />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold">{t("admin.analytics.sections.listings")}</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile label={t("admin.analytics.m.published")} value={stats.published} tone="success" />
              <StatTile label={t("admin.analytics.m.rejected")} value={stats.rejected} tone={stats.rejected ? "warning" : "default"} />
              <StatTile label={t("admin.analytics.m.closed_found_job")} value={stats.closed_found_job} tone="success" />
              <StatTile label={t("admin.analytics.m.closed_found_worker")} value={stats.closed_found_worker} tone="success" />
            </div>
            {Object.keys(stats.rejected_by_category ?? {}).length ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("admin.analytics.rejected_by")}: {Object.entries(stats.rejected_by_category).map(([k, v]) => `${t(`admin.moderation.categories.${k}`)} — ${v}`).join(" · ")}
              </p>
            ) : null}
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold">{t("admin.analytics.sections.matching")}</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile label={t("admin.analytics.m.matches_90")} value={stats.matches_90} tone="primary" hint={t("admin.analytics.m.matches_90_hint")} />
              <StatTile label={t("admin.analytics.m.subs_worker")} value={stats.subscriptions.worker} />
              <StatTile label={t("admin.analytics.m.subs_employer")} value={stats.subscriptions.employer} />
              <StatTile label={t("admin.analytics.m.subs_waiting")} value={stats.subscriptions.waiting_bot} hint={t("admin.analytics.m.subs_waiting_hint")} />
              <StatTile label={t("admin.analytics.m.tg_sent")} value={stats.telegram.sent} tone="success" />
              <StatTile label={t("admin.analytics.m.tg_failed")} value={stats.telegram.failed} tone={stats.telegram.failed ? "destructive" : "default"} />
              <StatTile label={t("admin.analytics.m.tg_opened")} value={stats.telegram.opened} hint={t("admin.analytics.m.tg_opened_hint")} />
              <StatTile label={t("admin.analytics.m.tg_queued")} value={stats.telegram.queued} href="/admin/queues" />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold">{t("admin.analytics.sections.ai")}</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile label={t("admin.analytics.m.ai_started")} value={stats.ai_listings.started} />
              <StatTile label={t("admin.analytics.m.ai_prepared")} value={stats.ai_listings.prepared} />
              <StatTile label={t("admin.analytics.m.ai_published")} value={stats.ai_listings.published} tone="success" />
              <StatTile label={t("admin.analytics.m.ai_requests")} value={`${num(stats.ai_usage.requests)} / ${num(stats.ai_usage.errors)}`} hint={t("admin.analytics.m.ai_requests_hint")} />
              <StatTile label={t("admin.analytics.m.ai_latency")} value={`${num(stats.ai_usage.avg_latency_ms)} / ${num(stats.ai_usage.p95_latency_ms)} ms`} hint={t("admin.analytics.m.ai_latency_hint")} />
              <StatTile label={t("admin.analytics.m.ai_cost")} value={`$${(stats.ai_usage.cost_usd ?? 0).toFixed(2)}`} hint={t("admin.analytics.m.ai_cost_hint")} />
              <StatTile label={t("admin.analytics.m.ai_tokens")} value={`${num(stats.ai_usage.input_tokens)} / ${num(stats.ai_usage.output_tokens)}`} />
              <StatTile label={t("admin.analytics.m.ai_images")} value={stats.ai_usage.images} />
            </div>
            {Object.keys(stats.ai_usage.by_feature ?? {}).length ? (
              <p className="mt-2 text-sm text-muted-foreground">{Object.entries(stats.ai_usage.by_feature).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
            ) : null}
          </section>

          <section>
            <h2 className="mb-1 text-base font-semibold">{t("admin.analytics.sections.funnel")}</h2>
            <p className="mb-3 text-sm text-muted-foreground">{t("admin.analytics.funnel_note")}</p>
            <ol className="space-y-2">
              {FUNNEL.map((step) => {
                const n = stats.funnel?.[step] ?? 0;
                return (
                  <li key={step} className="grid grid-cols-[minmax(8rem,14rem)_1fr_auto] items-center gap-3 text-sm">
                    <span>{t(`admin.analytics.funnel.${step}`)}</span>
                    <span className="h-3 overflow-hidden rounded-full bg-secondary">
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.round((n / funnelTop) * 100))}%` }} />
                    </span>
                    <span className="tabular font-semibold">{num(n)}</span>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div>
              <h2 className="mb-2 text-base font-semibold">{t("admin.analytics.top_professions")}</h2>
              <p className="mb-2 text-sm text-muted-foreground">{t("admin.analytics.searches_total", { n: num(stats.searches), zero: num(stats.searches_zero) })}</p>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1">{t("admin.analytics.col_profession")}</th>
                    <th className="py-1 text-right">{t("admin.analytics.col_searches")}</th>
                    <th className="py-1 text-right">{t("admin.analytics.col_zero")}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.top_professions.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="py-1.5">{name(r)}</td>
                      <td className="py-1.5 text-right tabular">{num(r.searches)}</td>
                      <td className="py-1.5 text-right tabular">{num(r.zero)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h2 className="mb-2 text-base font-semibold">{t("admin.analytics.zero_queries")}</h2>
              <table className="w-full text-sm">
                <tbody>
                  {stats.zero_queries.map((r) => (
                    <tr key={r.query} className="border-t border-border">
                      <td className="py-1.5 [overflow-wrap:anywhere]">{r.query}</td>
                      <td className="py-1.5 text-right tabular">{num(r.n)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!stats.zero_queries.length ? <p className="text-sm text-muted-foreground">{t("common.empty.nothing_here")}</p> : null}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">{t("admin.analytics.regions")}</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1">{t("admin.workers.region")}</th>
                    <th className="py-1 text-right">{t("admin.analytics.col_demand")}</th>
                    <th className="py-1 text-right">{t("admin.analytics.col_vacancies")}</th>
                    <th className="py-1 text-right">{t("admin.analytics.col_workers")}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.regions.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="py-1.5">{name(r)}</td>
                      <td className="py-1.5 text-right tabular">{num(r.demand)}</td>
                      <td className="py-1.5 text-right tabular">{num(r.vacancies)}</td>
                      <td className="py-1.5 text-right tabular">{num(r.workers)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {series.rows.length > 1 ? (
        <section className="grid gap-4 md:grid-cols-2">
          {CHARTS.map((c) => (
            <div key={c.key} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold">{t(`admin.analytics.series.${c.key}`)}</h3>
                <span className="text-lg font-bold tabular">{num(series.rows.reduce((a, r) => a + r[c.key], 0))}</span>
              </div>
              <DailyBarChart data={series.rows.map((r) => ({ day: r.day, value: r[c.key] }))} label={t(`admin.analytics.series.${c.key}`)} locale={locale} tone={c.tone} />
            </div>
          ))}
        </section>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {t("admin.analytics.honesty")} <Link href="/admin/search" className="underline">{t("admin.nav.search")}</Link>
      </p>
    </div>
  );
}
