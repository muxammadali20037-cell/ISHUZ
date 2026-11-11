import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Ko'rsatkich kartasi (panellar: "Faol e'lonlar", "Arizalar" …).
 * Halollik qoidasi: qiymat faqat bazadan hisoblangan haqiqiy son; noma'lum bo'lsa `null` — "—" ko'rsatiladi,
 * hech qachon taxminiy yoki to'qima raqam emas. Raqamlar tabular (ustunlarda tekis turadi).
 */
export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: number | null;
  /** qiymat ostidagi qisqa izoh (masalan "so'nggi 30 kun") */
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  /** raqamni formatlash (masalan so'm); berilmasa — o'zbekcha minglik ajratuvchi bilan */
  format?: (n: number) => string;
}

const defaultFormat = (n: number) => new Intl.NumberFormat("uz-UZ").format(n);

function StatCard({ label, value, hint, icon, format = defaultFormat, className, ...props }: StatCardProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4 shadow-sm", className)} {...props}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        {icon ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-ink [&_svg]:size-5" aria-hidden>
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums" data-value={value ?? ""}>
        {value === null ? "—" : format(value)}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export { StatCard };
