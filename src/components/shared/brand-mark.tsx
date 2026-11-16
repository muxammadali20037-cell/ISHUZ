import { BriefcaseBusiness } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Ish topdim" belgisi — 5.0 (2026-11-16, ega "ko'k-oq" dizayni): ko'k gradientli yumaloq-kvadrat (36 px da radius 12 px)
 * ichida oq "portfel". Faqat token (--gradient-brand) orqali; favicon va ilova belgilari — public/brand (o'zgarmagan).
 * O'lcham — `className` (masalan, `size-9`).
 */
export function BrandMark({ className, label }: { className?: string; label?: string; sizes?: string }) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("brand-fill inline-flex size-8 shrink-0 select-none items-center justify-center shadow-glow", className)}
      style={{ borderRadius: "33%" }}
    >
      <BriefcaseBusiness className="size-[56%]" strokeWidth={2.2} aria-hidden />
    </span>
  );
}
