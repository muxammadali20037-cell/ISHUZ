import { cn } from "@/lib/utils";
import { BrandMark } from "./brand-mark";
import { BrandWordmark } from "./brand-wordmark";

/**
 * To'liq logo: belgi + "Ish topdim" yozuvi (Inter, sarlavha shrifti). "stacked" — asosiy (tik) ko'rinish: ochilish ekrani,
 * kirish; "horizontal" — sarlavha va footer. Fayl ko'rinishlari (SVG/PNG) — public/brand (scripts/brand/build-brand.py).
 */
export function BrandLogo({
  layout = "horizontal",
  onDark = false,
  label,
  className,
}: {
  layout?: "horizontal" | "stacked";
  onDark?: boolean;
  /** ekran o'qigichi uchun nom; berilmasa — yozuv o'zi o'qiladi */
  label?: string;
  className?: string;
}) {
  const stacked = layout === "stacked";
  return (
    <span
      className={cn("inline-flex items-center font-display font-semibold tracking-tight", stacked ? "flex-col gap-3 text-4xl" : "gap-2.5 text-xl", className)}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      <BrandMark className={stacked ? "size-20" : "size-9"} sizes={stacked ? "80px" : "36px"} />
      <span className={onDark ? "text-navy-foreground" : "text-foreground"} aria-hidden={label ? true : undefined}>
        <BrandWordmark onDark={onDark} />
      </span>
    </span>
  );
}
