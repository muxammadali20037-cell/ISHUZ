import { cn } from "@/lib/utils";

/**
 * "Ish topdim" belgisi (2026-11, "Darvoza"): yuqori uchi o'tkir ravoq — O'zbekiston peshtoqlari, "imkoniyat darvozasi";
 * ichida oq belgi (✓) — "topdim". Sodda vektor: 16 px da ham o'qiladi, tarmoqsiz chiziladi (rasm yuklanmaydi).
 * Geometriya scripts/brand/build-brand.py bilan bir xil (favicon, ilova belgisi va logo fayllari o'sha skriptdan).
 *
 * tone:
 *  - "brand" (odatiy) — ko'k ravoq (qorong'i mavzuda yorqinroq ko'k), oq ✓;
 *  - "light" — to'q ko'k sirt ustida (yon menyu, footer): oq ravoq, ko'k ✓;
 *  - "tile" — ilova belgisi: ko'k plita ichida oq ravoq.
 */
export const BRAND_ARCH = "M9 59Q9 61 11 61H53Q55 61 55 59V31C55 19.5 45.5 10.5 32 3C18.5 10.5 9 19.5 9 31Z";
export const BRAND_CHECK = "M21 42L29.5 50.5L44 33";

export function BrandMark({ className, tone = "brand", label }: { className?: string; tone?: "brand" | "light" | "tile"; label?: string }) {
  const a11y = label ? { role: "img" as const, "aria-label": label } : { "aria-hidden": true as const };
  const check = (
    <path
      d={BRAND_CHECK}
      fill="none"
      strokeWidth={6.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={tone === "brand" ? "stroke-white" : "stroke-brand"}
    />
  );
  return (
    <svg viewBox="0 0 64 64" focusable="false" className={cn("block size-8 shrink-0", className)} {...a11y}>
      {tone === "tile" ? (
        <>
          <rect width="64" height="64" rx="14" className="fill-brand" />
          <g transform="translate(32 33) scale(0.72) translate(-32 -32)">
            <path d={BRAND_ARCH} className="fill-white" />
            {check}
          </g>
        </>
      ) : (
        <>
          <path d={BRAND_ARCH} className={tone === "brand" ? "fill-brand" : "fill-white"} />
          {check}
        </>
      )}
    </svg>
  );
}
