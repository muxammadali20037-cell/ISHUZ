"use client";

import Link from "next/link";
import { Gift } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export type ApplicationsTab = "active" | "archive";

function Count({ n, accent }: { n: number; accent?: boolean }) {
  if (!n) return null;
  return <span className={cn("ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular", accent ? "bg-destructive text-white" : "bg-secondary text-muted-foreground")}>{n > 99 ? "99+" : n}</span>;
}

/** Faol / Arxiv (URL ?tab=) + Takliflar (→ /offers) */
export function ApplicationsTabs({ active, counts, pendingOffers }: { active: ApplicationsTab; counts: Record<ApplicationsTab, number>; pendingOffers: number }) {
  const { t } = useT();
  const base = "flex flex-1 items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors";
  const idle = "text-muted-foreground hover:text-foreground";
  const on = "bg-card text-foreground shadow-sm";
  return (
    <nav className="flex w-full gap-1 rounded-xl bg-secondary p-1" aria-label={t("applications.meta.title")}>
      <Link href="/applications?tab=active" scroll={false} className={cn(base, active === "active" ? on : idle)} aria-current={active === "active" ? "page" : undefined}>
        {t("applications.tabs.active")}
        <Count n={counts.active} />
      </Link>
      <Link href="/applications?tab=archive" scroll={false} className={cn(base, active === "archive" ? on : idle)} aria-current={active === "archive" ? "page" : undefined}>
        {t("applications.tabs.archive")}
        <Count n={counts.archive} />
      </Link>
      <Link href="/offers" className={cn(base, idle)}>
        <Gift className="mr-1.5 size-4" />
        {t("applications.tabs.offers")}
        <Count n={pendingOffers} accent />
      </Link>
    </nav>
  );
}
