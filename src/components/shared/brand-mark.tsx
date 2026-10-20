import { cn } from "@/lib/utils";
import { BrandLogo } from "./brand-logo";

/**
 * "Ish topdim" belgisi (sarlavha, footer, kirish): logotipdagi qo'l berib so'rashayotgan ikki odam, oq plitada (har ikki
 * mavzuda). Qo'llar vaqti-vaqti bilan siqiladi (BrandLogo, uzun tanaffus bilan — chalg'itmasin). To'liq logo — BrandLogo.
 */
export function BrandMark({ className, animated = true }: { className?: string; animated?: boolean }) {
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-logo-tile p-0.5 shadow-sm ring-1 ring-black/5", className)} aria-hidden>
      <BrandLogo variant="mark" animated={animated} period={7} />
    </span>
  );
}
