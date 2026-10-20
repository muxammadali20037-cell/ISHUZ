"use client";

import { useId, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/**
 * "Ish topdim" logotipi (egasi bergan, 2026-10): yozuv va qo'l berib so'rashayotgan ikki odam. Fayllar —
 * scripts/brand/build-logo.py (manba rasmdan): yozuv va odamlar alohida shaffof qatlam.
 *
 * Harakat — "qo'l siqish": odamlar qatlamiga SVG siljish filtri (feDisplacementMap) qo'yiladi; xarita (handshake-map.png) faqat
 * qo'llar va bilaklar oralig'ini qimirlatadi — qo'llar ikki-uch marta pastga-tepaga siqiladi, tirsak va gavda joyida, yozuv
 * qimirlamaydi; keyin kichik sariq uchqun ("kelishildi"). Tanaffusdan so'ng takrorlanadi. prefers-reduced-motion — harakatsiz.
 *
 * Koordinatalar manba rasm piksellarida (1254 × 1254):
 *  - "full" — butun logo (yozuv + odamlar);
 *  - "mark" — faqat odamlar (kichik joylar: sarlavha, favicon) — yozuv 16–48 px da o'qilmaydi.
 * Fon — doim oq plita (logo ko'k; qorong'i mavzuda ham), plitani chaqiruvchi beradi.
 */
const SIZE = 1254;
const VIEW = { full: "58 170 1154 834", mark: "575 180 630 610" } as const;
const CLASP = { x: 851, y: 520 };

const noopSubscribe = () => () => {};
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function BrandLogo({
  variant = "full",
  animated = true,
  period = 3.6,
  label,
  className,
}: {
  variant?: "full" | "mark";
  animated?: boolean;
  /** bir sikl (soniya): qo'l siqish boshida ~1.5 s, qolgani — tanaffus */
  period?: number;
  /** ekran o'qigichi uchun nom; berilmasa — bezak (aria-hidden) */
  label?: string;
  className?: string;
}) {
  // serverda va gidratsiyagacha — harakatsiz; keyin svg qayta yaratiladi (SMIL vaqt chizig'i 0 dan boshlansin)
  const still = useSyncExternalStore(noopSubscribe, reducedMotion, () => true);
  const motion = animated && !still;
  const fid = `hs${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  // qo'llar siljishi (manba pikselida): odatdagi o'lchamda 2–4 px ko'rinadi; pump sari kamayadi
  const amp = variant === "mark" ? 60 : 46;
  const pump = 1.5 / period;
  const kt = (f: number) => (f * pump).toFixed(3);
  const ease = "0.42 0 0.58 1";

  return (
    <svg
      key={motion ? "m" : "s"}
      viewBox={VIEW[variant]}
      className={cn("block h-auto w-full", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {motion ? (
        <defs>
          <filter id={fid} x="0" y="0" width={SIZE} height={SIZE} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feImage href="/brand/handshake-map.png" x="0" y="0" width={SIZE} height={SIZE} preserveAspectRatio="none" result="map" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G">
              <animate
                attributeName="scale"
                dur={`${period}s`}
                repeatCount="indefinite"
                calcMode="spline"
                values={`0;${-amp};${amp * 0.85};${-amp * 0.7};${amp * 0.5};0;0`}
                keyTimes={`0;${kt(0.18)};${kt(0.38)};${kt(0.58)};${kt(0.78)};${kt(1)};1`}
                keySplines={`${ease};${ease};${ease};${ease};${ease};0 0 1 1`}
              />
            </feDisplacementMap>
          </filter>
        </defs>
      ) : null}
      {variant === "full" ? <image href="/brand/logo-text.webp" x="0" y="0" width={SIZE} height={SIZE} /> : null}
      {variant === "full" ? (
        <image href="/brand/logo-figures.webp" x="0" y="0" width={SIZE} height={SIZE} filter={motion ? `url(#${fid})` : undefined} />
      ) : (
        // kichik belgi: faqat odamlar qismi (yengil fayl), lekin o'sha koordinatalarda — siljish xaritasi mos keladi
        <image href="/brand/mark-figures.webp" x="575" y="180" width="630" height="610" preserveAspectRatio="none" filter={motion ? `url(#${fid})` : undefined} />
      )}
      {motion ? (
        // qo'l siqilgach — qo'llar ustida kichik sariq uchqun (brend urg'u rangi)
        <g transform={`translate(${CLASP.x} ${CLASP.y})`}>
          <g opacity="0">
            <animate attributeName="opacity" dur={`${period}s`} repeatCount="indefinite" values="0;0;1;0;0" keyTimes={`0;${kt(0.8)};${kt(0.92)};${kt(1.25)};1`} />
            <animateTransform
              attributeName="transform"
              type="scale"
              dur={`${period}s`}
              repeatCount="indefinite"
              values="0.3;0.3;1.1;0.7;0.7"
              keyTimes={`0;${kt(0.8)};${kt(0.92)};${kt(1.25)};1`}
            />
            <path d="M0 -38 C4 -10 10 -4 38 0 C10 4 4 10 0 38 C-4 10 -10 4 -38 0 C-10 -4 -4 -10 0 -38 Z" className="fill-highlight" transform="translate(-34 -10) scale(0.8)" />
            <path d="M0 -38 C4 -10 10 -4 38 0 C10 4 4 10 0 38 C-4 10 -10 4 -38 0 C-10 -4 -4 -10 0 -38 Z" className="fill-highlight" transform="translate(30 -26) scale(0.55)" />
          </g>
        </g>
      ) : null}
    </svg>
  );
}
