import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** E'lon holati: nuqta + qisqa matn (yashil — ommada, sariq — kutilmoqda, kulrang — to'xtatilgan) */
export function StatusPill({ tone, children }: { tone: "ok" | "wait" | "off"; children: ReactNode }) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-base font-semibold",
        tone === "ok" ? "bg-success-soft text-success" : tone === "wait" ? "bg-warning-soft text-warning" : "bg-secondary text-muted-foreground",
      )}
    >
      <span className={cn("size-2.5 rounded-full", tone === "ok" ? "bg-success" : tone === "wait" ? "bg-warning" : "bg-muted-foreground")} aria-hidden />
      {children}
    </p>
  );
}
