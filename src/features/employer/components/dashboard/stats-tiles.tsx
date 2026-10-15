import Link from "next/link";
import { Briefcase, Inbox, FileText, Eye, Bookmark, Send, UserCheck, Users, ChevronRight, type LucideIcon } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { getDashboardStats } from "../../queries";
import type { DashboardStats } from "../../types";

interface Tile {
  key: keyof DashboardStats;
  icon: LucideIcon;
  href: string;
  highlight?: boolean;
}

const TILES: Tile[] = [
  { key: "active_vacancies", icon: Briefcase, href: "/employer/vacancies" },
  { key: "new_applications", icon: Inbox, href: "/employer/vacancies", highlight: true },
  { key: "applications", icon: FileText, href: "/employer/vacancies" },
  { key: "views", icon: Eye, href: "/employer/vacancies" },
  { key: "saved_workers", icon: Bookmark, href: "/employer/saved" },
  { key: "offers_sent", icon: Send, href: "/employer/candidates" },
  { key: "hired", icon: UserCheck, href: "/employer/candidates" },
];

/** employer_dashboard_stats() → 7 ta karta (Suspense ichida) */
export async function StatsTiles() {
  const { t, locale } = await getT();
  const stats = await getDashboardStats();
  if (!stats) {
    return <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">{t("employer.dashboard.stats_error")}</p>;
  }
  const fmt = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : locale === "en" ? "en-US" : "uz-UZ");
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
      {TILES.map(({ key, icon: Icon, href, highlight }) => {
        const value = stats[key];
        const hot = highlight && value > 0;
        return (
          <Link
            key={key}
            href={href}
            className={cn(
              "group rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md",
              hot ? "border-primary/40 bg-primary-soft/40" : "border-border/70",
            )}
          >
            <span className={cn("flex size-9 items-center justify-center rounded-xl", hot ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground group-hover:text-primary")}>
              <Icon className="size-4.5" />
            </span>
            <p className={cn("mt-3 text-2xl font-extrabold tabular leading-none", hot && "text-primary")}>{fmt.format(value)}</p>
            <p className="mt-1.5 text-xs font-medium text-muted-foreground">{t(`employer.dashboard.stats.${key}`)}</p>
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Qisqa ko'rsatkichlar (bosh sahifa): faol vakansiyalar va yangi arizalar — employer_dashboard_stats() dan (haqiqiy son,
 * ma'lumot olinmasa — "—"), ostida mos nomzodlarga o'tish. Telefonda ikki ustun — birinchi ekranni egallamaydi.
 */
export async function KeyTiles({ candidatesHref }: { candidatesHref: string }) {
  const { t, locale } = await getT();
  const stats = await getDashboardStats();
  const fmt = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : locale === "en" ? "en-US" : "uz-UZ");
  const newApps = stats?.new_applications ?? null;
  const tiles = [
    { href: "/employer/vacancies", icon: Briefcase, label: t("employer.dashboard.stats.active_vacancies"), value: stats?.active_vacancies ?? null, hot: false },
    { href: "/employer/applications", icon: Inbox, label: t("employer.dashboard.stats.new_applications"), value: newApps, hot: (newApps ?? 0) > 0 },
  ];
  return (
    <div role="group" aria-label={t("easy.start.metrics_label")} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {tiles.map((x) => (
        <Link
          key={x.href}
          href={x.href}
          className={cn(
            "press flex min-h-20 flex-col justify-between gap-2 rounded-2xl border bg-card p-3.5 shadow-sm hover:border-primary/50",
            x.hot ? "border-primary/40 bg-primary-soft/40" : "border-border",
          )}
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <x.icon className={cn("size-4.5 shrink-0", x.hot ? "text-primary" : "")} aria-hidden />
            <span className="min-w-0 leading-tight">{x.label}</span>
          </span>
          <span className={cn("text-2xl font-extrabold tabular leading-none", x.hot && "text-primary")}>{x.value === null ? "—" : fmt.format(x.value)}</span>
        </Link>
      ))}
      <Link
        href={candidatesHref}
        className="press col-span-2 flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-2.5 shadow-sm hover:border-primary/50 sm:col-span-1 sm:min-h-20"
      >
        <Users className="size-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1 text-base font-semibold leading-tight">{t("employer.dashboard.matching")}</span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </div>
  );
}

/** KeyTiles skeleti — o'sha o'lchamda (kontent kelganda sahifa siljimaydi) */
export function KeyTilesSkeleton() {
  return (
    <div aria-hidden className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {[0, 1].map((i) => (
        <div key={i} className="min-h-20 rounded-2xl border border-border bg-card p-3.5">
          <div className="skeleton-shimmer h-4 w-24 rounded-lg" />
          <div className="skeleton-shimmer mt-3 h-6 w-10 rounded-lg" />
        </div>
      ))}
      <div className="skeleton-shimmer col-span-2 min-h-12 rounded-2xl sm:col-span-1 sm:min-h-20" />
    </div>
  );
}
