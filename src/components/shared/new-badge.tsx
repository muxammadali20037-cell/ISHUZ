"use client";

import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { isNewFeature, type NewFeature } from "@/config/new-features";

/**
 * Yangi bo'lim belgisi — yozuvsiz kichik yonib-o'chuvchi nuqta (ega, 2026-11-12: "yangi degan so'zlar kerak emas, qandaydir
 * bo'rtib chiqib tursa bo'ldi"). Rangi — atrofdagi matn rangi (`currentColor`), kerak bo'lsa `className` bilan (`text-…`).
 * Ekran o'quvchi uchun "Yangi" so'zi yashirin matnda qoladi. Muddati o'tgan bo'limda ko'rinmaydi (config/new-features.ts).
 */
export function NewDot({ feature, className }: { feature: NewFeature; className?: string }) {
  const { t } = useT();
  if (!isNewFeature(feature)) return null;
  return (
    <span data-new-dot={feature} className={cn("new-dot", className)}>
      <span className="sr-only">{t("common.badge.new")}</span>
    </span>
  );
}
