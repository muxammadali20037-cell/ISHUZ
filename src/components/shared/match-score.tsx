"use client";

import { Check, AlertTriangle, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export type MatchReason = { key: string; ok: boolean | "warn"; [param: string]: unknown };

function tone(score: number) {
  if (score >= 75) return { text: "text-success", bg: "bg-success-soft", ring: "stroke-success" };
  if (score >= 50) return { text: "text-warning", bg: "bg-warning-soft", ring: "stroke-warning" };
  return { text: "text-muted-foreground", bg: "bg-secondary", ring: "stroke-muted-foreground" };
}

/** "Sizga 89% mos" nishoni (kartalar uchun) */
export function MatchScore({ score, className, size = "md", label }: { score: number | null | undefined; className?: string; size?: "sm" | "md" | "lg"; label?: "long" | "short" }) {
  const { t } = useT();
  if (score === null || score === undefined) return null;
  const c = tone(score);
  const text = label === "long" ? t("common.labels.match", { score }) : label === "short" ? t("common.labels.match_short", { score }) : `${score}%`;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-lg font-bold tabular",
        size === "sm" ? "px-1.5 py-0.5 text-xs" : size === "lg" ? "px-3 py-1.5 text-base" : "px-2 py-1 text-sm",
        c.bg,
        c.text,
        className,
      )}
      aria-label={t("common.labels.match", { score })}
    >
      {text}
    </span>
  );
}

/** Katta aylana ko'rsatkich (detal sahifalar uchun) */
export function MatchRing({ score, className }: { score: number; className?: string }) {
  const { t } = useT();
  const c = tone(score);
  const r = 26;
  const circ = 2 * Math.PI * r;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" className="stroke-secondary" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" className={c.ring} strokeWidth="6" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)} />
      </svg>
      <div>
        <div className={cn("text-2xl font-extrabold tabular", c.text)}>{score}%</div>
        <div className="text-xs text-muted-foreground">{t("common.labels.match", { score }).replace(/\d+%/, "").trim()}</div>
      </div>
    </div>
  );
}

/** Moslik sabablari ro'yxati: ✓ mos, ⚠ qisman, ✗ mos emas */
export function MatchReasons({ reasons, className, compact }: { reasons: MatchReason[] | null | undefined; className?: string; compact?: boolean }) {
  const { t, tEnum } = useT();
  if (!reasons?.length) return null;
  const items = compact ? reasons.filter((r) => r.ok !== true).slice(0, 3).concat(reasons.filter((r) => r.ok === true).slice(0, 2)) : reasons;
  return (
    <ul className={cn("space-y-1.5", className)}>
      {items.map((r, i) => {
        const params: Record<string, string | number> = {};
        for (const [k, v] of Object.entries(r)) {
          if (k === "key" || k === "ok") continue;
          if (k === "lang" && typeof v === "string") params[k] = tEnum("language_code", v);
          else if (k === "level" && typeof v === "string") params[k] = r.key === "education_required" ? tEnum("education_level", v) : tEnum("language_level", v);
          else if (typeof v === "string" || typeof v === "number") params[k] = v;
        }
        const Icon = r.ok === true ? Check : r.ok === "warn" ? AlertTriangle : X;
        const color = r.ok === true ? "text-success" : r.ok === "warn" ? "text-warning" : "text-destructive";
        return (
          <li key={`${r.key}-${i}`} className="flex items-start gap-2 text-sm">
            <Icon className={cn("mt-0.5 size-4 shrink-0", color)} strokeWidth={2.5} />
            <span>{t(`enums.match_reason.${r.key}`, params)}</span>
          </li>
        );
      })}
    </ul>
  );
}
