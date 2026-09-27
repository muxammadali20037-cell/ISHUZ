import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptySuggestion {
  label: string;
  count: number;
  href: string;
}

/**
 * "Hech narsa topilmadi" o'rniga: qaysi filtrni olib tashlasa nechta natija chiqishini ko'rsatadi.
 * Faqat haqiqiy hisoblangan (count > 0) takliflar ko'rsatiladi.
 */
export function SmartEmptyState({
  icon: Icon,
  title,
  description,
  suggestionsTitle,
  suggestions,
  countLabel,
  fallback,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  suggestionsTitle: string;
  suggestions: EmptySuggestion[];
  countLabel: (count: number) => string;
  fallback?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-dashed border-border px-4 py-8 sm:px-6", className)}>
      <div className="flex flex-col items-center text-center">
        <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Icon className="size-7" />
        </div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {suggestions.length ? (
        <div className="mx-auto mt-5 max-w-md">
          <p className="mb-2 text-sm font-semibold">{suggestionsTitle}</p>
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2.5 text-sm transition-colors hover:border-primary/50 hover:bg-primary-soft/40 active:scale-[0.99]"
                >
                  <span className="min-w-0 font-medium">{s.label}</span>
                  <span className="flex shrink-0 items-center gap-1.5 font-semibold text-primary">
                    {countLabel(s.count)}
                    <ArrowRight className="size-4" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {fallback ? (
        <div className="mt-5 text-center">
          <Link href={fallback.href} className="text-sm font-semibold text-primary hover:underline">
            {fallback.label}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
