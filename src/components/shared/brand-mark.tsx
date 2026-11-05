import Image from "next/image";
import { cn } from "@/lib/utils";
import markPng from "@/assets/brand/ishtopdim-mark.png";

/**
 * "Ish topdim" belgisi (egasi, 2026-11-05): oq plita ichida ko'k odam va yuqoriga strelka — "ish topdim, oldinga".
 * Egasi bergan rasm o'zgartirilmaydi; manba — scripts/brand/source/ishtopdim-mark-original.png, kesim va o'lchamlar —
 * scripts/brand/build-brand.py (favicon, ilova belgilari va logo fayllari ham o'sha yerdan). Plita oq bo'lgani uchun
 * och va to'q fonda bir xil ko'rinadi — alohida "to'q fon" varianti kerak emas.
 *
 * O'lcham — `className` (masalan, `size-9`); `sizes` brauzerga kerakli eng kichik faylni tanlash uchun.
 */
export function BrandMark({ className, label, sizes = "80px" }: { className?: string; label?: string; sizes?: string }) {
  return (
    <Image
      src={markPng}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      sizes={sizes}
      loading="eager"
      draggable={false}
      className={cn("block size-8 shrink-0 select-none object-contain", className)}
    />
  );
}
