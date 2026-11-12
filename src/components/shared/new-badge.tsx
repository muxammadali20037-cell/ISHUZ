"use client";

import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { isNewFeature, type NewFeature } from "@/config/new-features";

/** Kichik "Yangi" belgisi (to'q sariq). Muddati o'tgan bo'limda ko'rinmaydi. `tone="dark"` — to'q ko'k yon menyu */
export function NewBadge({ feature, tone = "light", className }: { feature: NewFeature; tone?: "light" | "dark"; className?: string }) {
  const { t } = useT();
  if (!isNewFeature(feature)) return null;
  return (
    <span
      data-new-badge={feature}
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-full px-1.5 text-2xs font-bold uppercase tracking-wide",
        tone === "dark" ? "bg-ai-bright text-navy" : "bg-ai text-ai-foreground",
        className,
      )}
    >
      {t("common.badge.new")}
    </span>
  );
}
