import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return n.toLocaleString("ru-RU");
}

/** Statistika kartasi: yorliq + katta raqam (+ ixtiyoriy havola/izoh) */
export function StatTile({
  label,
  value,
  hint,
  href,
  icon,
  tone = "default",
  className,
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
  icon?: ReactNode;
  tone?: "default" | "primary" | "warning" | "destructive" | "success";
  className?: string;
}) {
  const tones = {
    default: "bg-secondary text-foreground",
    primary: "bg-primary-soft text-primary",
    warning: "bg-warning-soft text-warning",
    destructive: "bg-destructive-soft text-destructive",
    success: "bg-success-soft text-success",
  };
  const body = (
    <div className={cn("flex h-full flex-col rounded-2xl border border-border/70 bg-card p-4 shadow-sm", href && "transition-shadow hover:shadow-md", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        {icon ? <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4", tones[tone])}>{icon}</span> : null}
      </div>
      <p className="mt-2 text-2xl font-bold leading-none tracking-tight tabular sm:text-3xl" title={typeof value === "number" ? value.toLocaleString("ru-RU") : undefined}>
        {typeof value === "number" ? compact(value) : value}
      </p>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
