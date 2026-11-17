import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** E'lon holati: nuqta + qisqa matn (yashil — ommada, sariq — kutilmoqda, kulrang — to'xtatilgan) */
export function StatusPill({ tone, size = "md", children }: { tone: "ok" | "wait" | "off"; size?: "sm" | "md"; children: ReactNode }) {
  return (
    <p
      data-status-pill={tone}
      className={cn(
        "inline-flex items-center rounded-xl font-semibold",
        size === "sm" ? "gap-1.5 px-2.5 py-1 text-sm leading-snug" : "gap-2 px-3 py-1.5 text-base",
        tone === "ok" ? "bg-success-soft text-success" : tone === "wait" ? "bg-warning-soft text-warning" : "bg-secondary text-muted-foreground",
      )}
    >
      <span className={cn("shrink-0 rounded-full", size === "sm" ? "size-2" : "size-2.5", tone === "ok" ? "bg-success" : tone === "wait" ? "bg-warning" : "bg-muted-foreground")} aria-hidden />
      {children}
    </p>
  );
}
