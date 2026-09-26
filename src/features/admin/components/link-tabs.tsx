import Link from "next/link";
import { cn } from "@/lib/utils";

export interface LinkTab {
  href: string;
  label: string;
  count?: number;
  active: boolean;
}

/** Holat tab'lari (GET havolalar), soni bilan */
export function LinkTabs({ tabs, className }: { tabs: LinkTab[]; className?: string }) {
  return (
    <div className={cn("mb-4 flex gap-1 overflow-x-auto rounded-xl bg-secondary p-1 scrollbar-none", className)} role="tablist">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          role="tab"
          aria-selected={tab.active}
          className={cn(
            "flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors",
            tab.active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span className={cn("rounded-full px-1.5 text-[11px] font-semibold tabular", tab.active ? "bg-primary-soft text-primary" : "bg-card/70 text-muted-foreground")}>{tab.count}</span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
