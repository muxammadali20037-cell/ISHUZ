"use client";

import { Star } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** 1–5 yulduz: tanlash (onChange) yoki faqat ko'rsatish (readOnly) */
export function StarRating({ value, onChange, size = "md", className }: { value: number; onChange?: (v: number) => void; size?: "sm" | "md" | "lg"; className?: string }) {
  const { t } = useT();
  const px = size === "lg" ? "size-9" : size === "sm" ? "size-4" : "size-6";
  const readOnly = !onChange;
  return (
    <div className={cn("inline-flex items-center gap-1", className)} role={readOnly ? "img" : "radiogroup"} aria-label={t("applications.review.star", { n: value })}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        const icon = <Star className={cn(px, filled ? "fill-warning text-warning" : "text-border")} strokeWidth={1.75} />;
        if (readOnly) return <span key={n}>{icon}</span>;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={t("applications.review.star", { n })}
            onClick={() => onChange(n)}
            className="flex size-11 items-center justify-center rounded-lg transition-transform hover:scale-110 active:scale-95"
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
}
