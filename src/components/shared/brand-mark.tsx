import { cn } from "@/lib/utils";

/** "Ish topdim" belgisi: portfel + belgi (topildi). Ikonlar (public/icon.svg) bilan bir xil shakl. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground", className)} aria-hidden>
      <svg viewBox="0 0 512 512" className="size-[78%]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M196 168 V140 A28 28 0 0 1 224 112 H288 A28 28 0 0 1 316 140 V168" strokeWidth="40" />
        <rect x="100" y="168" width="312" height="232" rx="48" strokeWidth="40" />
        <path d="M190 284 L240 332 L326 240" strokeWidth="44" />
      </svg>
    </span>
  );
}
