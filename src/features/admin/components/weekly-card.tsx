import { CalendarRange, TrendingDown, TrendingUp } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { perVacancy, type WeeklyKpis } from "../weekly";
import type { WeeklyComparison } from "../weekly.server";
import { QueryError } from "./notes";

type Key = "employers" | "vacancies" | "applications" | "visitors" | "topBuyers" | "repeatBuyers" | "revenue";

const ROWS: { key: Key; label: string }[] = [
  { key: "employers", label: "employers" },
  { key: "vacancies", label: "vacancies" },
  { key: "applications", label: "applications" },
  { key: "visitors", label: "visitors" },
  { key: "topBuyers", label: "top_buyers" },
  { key: "repeatBuyers", label: "repeat_buyers" },
  { key: "revenue", label: "revenue" },
];

/**
 * Haftalik raqamlar: oxirgi tugagan hafta (dushanba–yakshanba, Toshkent) va undan oldingisi yonma-yon.
 * Xuddi shu raqamlar har dushanba 09:00 da adminlarga bildirishnoma (va Telegram) bo'lib boradi.
 */
export async function WeeklyCard({ data, error }: { data: WeeklyComparison | null; error: string | null }) {
  const { t, locale } = await getT();
  if (!data) return <QueryError message={error ?? "—"} />;
  const { range, cur, prev } = data;
  const fmt = (key: Key, k: WeeklyKpis) => (key === "revenue" ? formatMoney(k.revenue, locale) : `${k[key].toLocaleString("ru-RU")}${key === "visitors" && k.visitorsCapped ? "+" : ""}`);
  const period = `${formatDate(range.firstDay, locale, "d MMMM")} – ${formatDate(range.lastDay, locale, "d MMMM")}`;

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5" aria-labelledby="weekly-title" data-weekly-card>
      <div className="flex flex-wrap items-center gap-2">
        <CalendarRange className="size-5 text-primary-ink" aria-hidden />
        <h2 id="weekly-title" className="text-base font-semibold">
          {t("admin.weekly.title")}
        </h2>
        <span className="text-sm text-muted-foreground" data-weekly-period>
          {period}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t("admin.weekly.hint")}</p>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="py-1 text-left font-normal">{t("admin.weekly.col_metric")}</th>
            <th className="py-1 text-right font-normal">{t("admin.weekly.col_week")}</th>
            <th className="py-1 text-right font-normal">{t("admin.weekly.col_prev")}</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(({ key, label }) => {
            const diff = cur[key] - prev[key];
            return (
              <tr key={key} className="border-t border-border/60" data-weekly-row={key}>
                <td className="py-2 pr-2">{t(`notifications.weekly.${label}`)}</td>
                <td className="whitespace-nowrap py-2 text-right font-semibold tabular">
                  <span className="inline-flex items-center justify-end gap-1">
                    {diff !== 0 ? (
                      <span className={cn("inline-flex items-center", diff > 0 ? "text-success" : "text-destructive")} aria-label={t(diff > 0 ? "admin.weekly.up" : "admin.weekly.down")}>
                        {diff > 0 ? <TrendingUp className="size-3.5" aria-hidden /> : <TrendingDown className="size-3.5" aria-hidden />}
                      </span>
                    ) : null}
                    <span data-weekly-value>{fmt(key, cur)}</span>
                  </span>
                </td>
                <td className="whitespace-nowrap py-2 pl-3 text-right text-muted-foreground tabular">{fmt(key, prev)}</td>
              </tr>
            );
          })}
          <tr className="border-t border-border/60" data-weekly-row="per_vacancy">
            <td className="py-2 pr-2">{t("notifications.weekly.per_vacancy")}</td>
            <td className="whitespace-nowrap py-2 text-right font-semibold tabular">{perVacancy(cur)}</td>
            <td className="whitespace-nowrap py-2 pl-3 text-right text-muted-foreground tabular">—</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
