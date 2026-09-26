"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type { OffersTab } from "../types";

function Count({ n, accent }: { n: number; accent?: boolean }) {
  if (!n) return null;
  return <span className={cn("ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular", accent ? "bg-destructive text-white" : "bg-secondary text-muted-foreground")}>{n > 99 ? "99+" : n}</span>;
}

/** Yangi / Javob berilgan (URL ?tab=) + Arizalar havolasi */
export function OffersTabs({ active, counts }: { active: OffersTab; counts: Record<OffersTab, number> }) {
  const { t } = useT();
  const base = "flex flex-1 items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors";
  const idle = "text-muted-foreground hover:text-foreground";
  const on = "bg-card text-foreground shadow-sm";
  return (
    <nav className="flex w-full gap-1 rounded-xl bg-secondary p-1" aria-label={t("offers.meta.title")}>
      <Link href="/offers?tab=new" scroll={false} className={cn(base, active === "new" ? on : idle)} aria-current={active === "new" ? "page" : undefined}>
        {t("offers.tabs.new")}
        <Count n={counts.new} accent={active !== "new"} />
      </Link>
      <Link href="/offers?tab=answered" scroll={false} className={cn(base, active === "answered" ? on : idle)} aria-current={active === "answered" ? "page" : undefined}>
        {t("offers.tabs.answered")}
        <Count n={counts.answered} />
      </Link>
      <Link href="/applications" className={cn(base, idle)}>
        <FileText className="mr-1.5 size-4" />
        {t("common.nav.applications")}
      </Link>
    </nav>
  );
}
