import Link from "next/link";
import { Briefcase, Inbox, FileText, Users, ChevronRight } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { getDashboardStats, getPipelineTotals } from "../../queries";

/**
 * Bugungi ishlar: yangi arizalar (bo'lsa ko'k), faol vakansiyalar, jami arizalar (2026-10-31 auditi) va mos nomzodlarga o'tish.
 * Sonlar employer_dashboard_stats() dan (haqiqiy; olinmasa — "—"). Katta rangli plitkalar yo'q. Yopilganlar — "Tarix" bo'limida.
 */
export async function KeyTiles({ candidatesHref }: { candidatesHref: string }) {
  const { t, locale } = await getT();
  const stats = await getDashboardStats();
  const fmt = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : locale === "en" ? "en-US" : "uz-UZ");
  const newApps = stats?.new_applications ?? null;
  const tiles = [
    { href: "/employer/applications", icon: Inbox, label: t("employer.dashboard.stats.new_applications"), value: newApps, hot: (newApps ?? 0) > 0 },
    { href: "/employer/vacancies", icon: Briefcase, label: t("employer.dashboard.stats.active_vacancies"), value: stats?.active_vacancies ?? null, hot: false },
    { href: "/employer/applications", icon: FileText, label: t("employer.dashboard.stats.applications"), value: stats?.applications ?? null, hot: false },
  ];
  return (
    <div role="group" aria-label={t("easy.start.metrics_label")} className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-4">
      {tiles.map((x) => (
        <Link key={x.label} href={x.href} className="press flex min-h-16 flex-col justify-center gap-0.5 px-4 py-3 hover:bg-secondary/60">
          <span className={cn("text-2xl font-extrabold tabular leading-none", x.hot && "text-primary-ink")}>{x.value === null ? "—" : fmt.format(x.value)}</span>
          <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <x.icon className={cn("size-4 shrink-0", x.hot && "text-primary-ink")} aria-hidden />
            <span className="min-w-0 leading-tight">{x.label}</span>
          </span>
        </Link>
      ))}
      <Link
        href={candidatesHref}
        className="press col-span-3 flex min-h-12 items-center gap-2 border-t border-border px-4 py-3 text-base font-semibold text-primary-ink hover:bg-secondary/60 sm:col-span-1 sm:border-t-0"
      >
        <Users className="size-5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 leading-tight">{t("employer.dashboard.matching")}</span>
        <ChevronRight className="size-5 shrink-0" aria-hidden />
      </Link>
    </div>
  );
}

/** KeyTiles skeleti — o'sha o'lchamda (kontent kelganda sahifa siljimaydi) */
export function KeyTilesSkeleton() {
  return (
    <div aria-hidden className="grid min-h-16 grid-cols-3 gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <div className="skeleton-shimmer h-6 w-10 rounded-lg" />
          <div className="skeleton-shimmer h-4 w-24 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/**
 * Arizalar holati (S3): barcha vakansiyalar bo'yicha yangi → ko'rilgan → saralangan → suhbat → ishga olingan (aniq sonlar).
 * Arizasi yo'q ish beruvchida ko'rsatilmaydi (bo'sh nollar qatori yo'q).
 */
export async function PipelineTiles({ userId, companyId }: { userId: string; companyId: string | null }) {
  const { t, locale } = await getT();
  const totals = await getPipelineTotals(userId, companyId);
  if (!totals || Object.values(totals).every((v) => v === 0)) return null;
  const fmt = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : locale === "en" ? "en-US" : "uz-UZ");
  const keys = ["sent", "viewed", "shortlisted", "interview", "hired"] as const;
  return (
    <section aria-labelledby="pipeline-title">
      <h2 id="pipeline-title" className="mb-2 text-base font-bold">
        {t("employer.dashboard.pipeline_title")}
      </h2>
      <ul className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {keys.map((k) => (
          <li key={k} className="flex">
            <Link href="/employer/applications" className="press flex w-full flex-col items-center justify-center rounded-lg border border-border bg-card px-1 py-2.5 text-center hover:border-primary/40">
              <span className={cn("text-lg font-extrabold tabular leading-tight", k === "sent" && totals[k] > 0 && "text-primary-ink")}>{fmt.format(totals[k])}</span>
              <span className="mt-0.5 text-2xs font-semibold leading-tight text-muted-foreground">{t(`employer.dashboard.pipeline.${k}`)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
