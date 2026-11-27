"use client";

import type { ButtonHTMLAttributes } from "react";
import { Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StartTileTone = "navy" | "green" | "yellow";

const TONE: Record<StartTileTone, { box: string; glow: string; glow2: string; line: string; badge: string }> = {
  navy: { box: "border-navy-foreground/15 bg-navy-2/90 text-navy-foreground", glow: "bg-accent-bright opacity-80", glow2: "bg-primary/40", line: "bg-navy-foreground/40", badge: "bg-navy-foreground/15 text-navy-foreground ring-navy-foreground/25" },
  green: { box: "border-success bg-success text-success-foreground", glow: "bg-success-soft opacity-40", glow2: "bg-card/20", line: "bg-card/50", badge: "bg-card/20 text-success-foreground ring-card/40" },
  yellow: { box: "border-highlight bg-highlight text-highlight-foreground", glow: "bg-card opacity-70", glow2: "bg-card/40", line: "bg-card/70", badge: "bg-card/80 text-highlight-foreground ring-card" },
};

/** "glow" ko'rinishida tugma ostidan taraladigan nur rangi */
const GLOW: Record<StartTileTone, string> = { navy: "bg-primary", green: "bg-success", yellow: "bg-highlight" };

/**
 * Bosh ekran va kirish menyusidagi ingichka tugma (ega, 2026-11-27): belgi chapda, yozuv yonida, balandligi ~56 px.
 * `busy` — belgi o'rnida aylanuvchi (forma yuborilmoqda); `badge` — yozuv ostida kichik izoh (masalan, "oxirgi tanlov").
 */
export function StartTile({
  icon: Icon,
  label,
  tone,
  busy,
  badge,
  look = "solid",
  className,
  ...props
}: {
  icon: LucideIcon;
  label: string;
  tone: StartTileTone;
  busy?: boolean;
  badge?: string | null;
  /**
   * glow — kirish menyusi (ega, 2026-11-27: "bu oynada nur soyadan chiqsin, rang yo'q bo'lsin — yashil, ko'k kerak emas,
   * rang orqa fondan nur orqali chiqsin"): tugmaning o'zi oq (bg-card), rang faqat ostidagi soyadan taralgan yumshoq nurda
   */
  look?: "solid" | "glow";
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  const c = TONE[tone];
  if (look === "glow") {
    return (
      <div className="relative isolate">
        <span aria-hidden className={cn("absolute inset-x-4 -bottom-2.5 top-3 -z-10 rounded-2xl opacity-50 blur-xl", GLOW[tone])} data-tile-glow />
        <button
          type="button"
          className={cn(
            "press relative flex min-h-14 w-full min-w-0 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2 text-left text-base font-bold leading-tight text-foreground shadow-sm transition-transform [overflow-wrap:anywhere] hover:-translate-y-0.5 disabled:opacity-60 sm:min-h-16 sm:text-lg",
            className,
          )}
          {...props}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground ring-1 ring-border" aria-hidden>
            {busy ? <Loader2 className="size-5 animate-spin" /> : <Icon className="size-5" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block" data-tile-label>
              {label}
            </span>
            {badge ? <span className="mt-0.5 block text-xs font-semibold text-muted-foreground">{badge}</span> : null}
          </span>
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      className={cn(
        "press relative isolate flex min-h-14 w-full min-w-0 items-center gap-3 overflow-hidden rounded-2xl border px-4 py-2 text-left text-base font-bold leading-tight shadow-md backdrop-blur-md transition-transform [overflow-wrap:anywhere] hover:-translate-y-0.5 disabled:opacity-60 sm:min-h-16 sm:text-lg",
        c.box,
        className,
      )}
      {...props}
    >
      {/* ichki nur: burchakdagi rangli va pastdagi yumshoq dog' + tepadagi ingichka yaltirash */}
      <span aria-hidden className={cn("absolute -right-6 -top-10 -z-10 size-24 rounded-full blur-2xl", c.glow)} />
      <span aria-hidden className={cn("absolute -bottom-10 -left-8 -z-10 size-20 rounded-full blur-2xl", c.glow2)} />
      <span aria-hidden className={cn("absolute inset-x-4 top-0 h-px", c.line)} />
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full ring-1", c.badge)} aria-hidden>
        {busy ? <Loader2 className="size-5 animate-spin" /> : <Icon className="size-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block" data-tile-label>
          {label}
        </span>
        {badge ? <span className="mt-0.5 block text-xs font-semibold opacity-90">{badge}</span> : null}
      </span>
    </button>
  );
}
