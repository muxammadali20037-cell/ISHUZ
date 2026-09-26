import { getT } from "@/lib/i18n/server";
import { DAILY_METRICS, type DailyStat, type DailyMetric } from "../queries/dashboard";
import { DailyBarChart } from "./charts";
import { LinkTabs } from "./link-tabs";

const TONES: Record<DailyMetric, "primary" | "success" | "warning"> = { registrations: "primary", vacancies: "warning", applications: "primary", hires: "success" };

/** 4 ta kichik ko'p-diagramma (small multiples): ro'yxat, vakansiya, ariza, ishga olish */
export async function DailyCharts({ rows, totals }: { rows: DailyStat[]; totals: Record<DailyMetric, number> }) {
  const { t, locale } = await getT();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {DAILY_METRICS.map((m) => (
        <div key={m} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">{t(`admin.metrics.${m}`)}</h3>
            <span className="text-lg font-bold tabular">{totals[m].toLocaleString("ru-RU")}</span>
          </div>
          <DailyBarChart data={rows.map((r) => ({ day: r.day, value: r[m] }))} label={t(`admin.metrics.${m}`)} locale={locale} tone={TONES[m]} />
        </div>
      ))}
    </div>
  );
}

/** 7 / 30 / 90 kun tanlovi (?days=) */
export async function DaysToggle({ base, days, extra }: { base: string; days: number; extra?: Record<string, string> }) {
  const { t } = await getT();
  const mk = (d: number) => {
    const p = new URLSearchParams(extra);
    p.set("days", String(d));
    return `${base}?${p.toString()}`;
  };
  return (
    <LinkTabs
      className="mb-0 w-fit"
      tabs={[7, 30, 90].map((d) => ({ href: mk(d), label: t("admin.analytics.last_days", { days: d }), active: days === d }))}
    />
  );
}
