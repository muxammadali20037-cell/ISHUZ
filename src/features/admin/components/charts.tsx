"use client";

import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export interface ChartPoint {
  /** ISO sana (YYYY-MM-DD) */
  day: string;
  value: number;
}

function niceMax(max: number): number {
  if (max <= 0) return 4;
  const pow = 10 ** Math.floor(Math.log10(max));
  const n = max / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function shortDay(iso: string, locale: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(locale === "ru" ? "ru-RU" : "uz-UZ", { day: "numeric", month: "short" });
}

/**
 * Kunlik ustunli diagramma (bitta seriya). Inline SVG, tema ranglari CSS token'lardan.
 * Hover/focus: tooltip (sana + qiymat). Barcha qiymatlar jadval ko'rinishida ham mavjud (analytics).
 */
export function DailyBarChart({
  data,
  label,
  locale,
  height = 160,
  tone = "primary",
  className,
}: {
  data: ChartPoint[];
  label: string;
  locale: string;
  height?: number;
  tone?: "primary" | "success" | "warning";
  className?: string;
}) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const W = 600;
  const H = height;
  const padL = 34;
  const padR = 6;
  const padT = 8;
  const padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = useMemo(() => niceMax(Math.max(0, ...data.map((d) => d.value))), [data]);
  const n = Math.max(1, data.length);
  const slot = innerW / n;
  const gap = 2;
  const barW = Math.min(24, Math.max(2, slot - gap));
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const color = tone === "success" ? "var(--success)" : tone === "warning" ? "var(--warning)" : "var(--primary)";
  const labelEvery = n > 45 ? 15 : n > 20 ? 7 : n > 10 ? 3 : 1;
  const total = data.reduce((s, d) => s + d.value, 0);
  const activePoint = active !== null ? data[active] : undefined;

  return (
    <figure className={cn("relative", className)} aria-label={label}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-labelledby={`${id}-title`}>
        <title id={`${id}-title`}>{label}</title>
        {ticks.map((tick) => {
          const y = padT + innerH - (max ? (tick / max) * innerH : 0);
          return (
            <g key={tick}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} />
              <text x={padL - 6} y={y + 3.5} textAnchor="end" fontSize={10} fill="var(--muted-foreground)" className="tabular">
                {tick.toLocaleString("ru-RU")}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x = padL + i * slot + (slot - barW) / 2;
          const h = max ? (d.value / max) * innerH : 0;
          const y = padT + innerH - h;
          const isActive = active === i;
          const r = Math.min(4, barW / 2, h);
          const path = h > 0 ? `M${x},${padT + innerH} v${-(h - r)} a${r},${r} 0 0 1 ${r},${-r} h${barW - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} z` : "";
          return (
            <g key={d.day}>
              {path ? <path d={path} fill={color} opacity={isActive ? 1 : 0.82} /> : null}
              <rect
                x={padL + i * slot}
                y={padT}
                width={slot}
                height={innerH}
                fill="transparent"
                tabIndex={0}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                aria-label={`${shortDay(d.day, locale)}: ${d.value}`}
                className="outline-none"
              />
              {i % labelEvery === 0 || i === n - 1 ? (
                <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)">
                  {shortDay(d.day, locale)}
                </text>
              ) : null}
            </g>
          );
        })}
        <line x1={padL} x2={W - padR} y1={padT + innerH} y2={padT + innerH} stroke="var(--border)" strokeWidth={1} />
      </svg>
      {activePoint ? (
        <div
          className="pointer-events-none absolute top-1 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: `${Math.min(88, Math.max(4, ((padL + (active ?? 0) * slot + slot / 2) / W) * 100))}%`, transform: "translateX(-50%)" }}
          role="status"
        >
          <p className="text-sm font-semibold tabular text-foreground">{activePoint.value.toLocaleString("ru-RU")}</p>
          <p className="text-muted-foreground">{shortDay(activePoint.day, locale)}</p>
        </div>
      ) : null}
      <figcaption className="sr-only">
        {label}: {total}
      </figcaption>
    </figure>
  );
}
