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
 * Soddalashtirilgan bosh sahifa: faqat 3 ta asosiy karta — faol vakansiyalar, yangi arizalar, mos nomzodlar.
 * (To'liq statistika /employer/vacancies da.)
 */
export async function KeyTiles({ candidatesHref }: { candidatesHref: string }) {
  const { t, locale } = await getT();
  const stats = await getDashboardStats();
  const fmt = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : locale === "en" ? "en-US" : "uz-UZ");
  const tiles = [
    { href: "/employer/vacancies", icon: Briefcase, label: t("employer.dashboard.stats.active_vacancies"), value: stats?.active_vacancies ?? null, hot: false },
    { href: "/employer/candidates", icon: Inbox, label: t("employer.dashboard.stats.new_applications"), value: stats?.new_applications ?? null, hot: (stats?.new_applications ?? 0) > 0 },
    { href: candidatesHref, icon: Users, label: t("employer.dashboard.matching"), value: null, hot: false },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {tiles.map((x) => (
        <Link
          key={x.href + x.label}
          href={x.href}
          className={cn(
            "flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md",
            x.hot ? "border-primary/40 bg-primary-soft/40" : "border-border/70",
          )}
        >
          <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", x.hot ? "bg-primary text-primary-foreground" : "bg-secondary text-primary")}>
            <x.icon className="size-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">{x.label}</span>
            {x.value !== null ? <span className={cn("block text-2xl font-extrabold tabular leading-tight", x.hot && "text-primary")}>{fmt.format(x.value)}</span> : null}
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        </Link>
      ))}
    </div>
  );
}
