import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Kirish oqimi ekranlari uchun umumiy qolip (mobil ilova kabi): tepada — orqaga / o'tkazib yuborish, o'rtada — asosiy mazmun,
 * pastda — asosiy tugma (yopishqoq, safe-area va klaviatura ustida). Kompyuterda — markazdagi telefon kengligidagi karta.
 * Pastki menyu va sayt sarlavhasi yo'q: foydalanuvchi bitta ishga e'tibor beradi.
 */
export function EntryScreen({
  left,
  right,
  footer,
  children,
  className,
}: {
  left?: ReactNode;
  right?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background sm:items-center sm:justify-center sm:bg-secondary sm:py-8">
      <div
        className={cn(
          "flex w-full flex-1 flex-col pt-[max(0.5rem,var(--safe-top))] sm:max-w-md sm:flex-none sm:rounded-2xl sm:border sm:border-border sm:bg-background sm:shadow-sm",
          "sm:min-h-[min(760px,calc(100dvh-4rem))]",
          className,
        )}
      >
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 px-2">
          <div className="flex min-w-11 items-center">{left}</div>
          <div className="flex min-w-11 items-center justify-end">{right}</div>
        </header>
        <main className="flex min-h-0 flex-1 flex-col px-5">{children}</main>
        {footer ? <div className="sticky bottom-0 z-10 bg-background px-5 pb-[max(1rem,var(--safe-bottom))] pt-3 sm:rounded-b-2xl">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Tepadagi "orqaga" — 44×44 bosish maydoni */
export function EntryBack({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} aria-label={label} className="inline-flex size-11 items-center justify-center rounded-xl text-foreground hover:bg-secondary">
      <ChevronLeft className="size-6" aria-hidden />
    </Link>
  );
}

/** Ekran sarlavhasi va izohi (markazda) */
export function EntryHeading({ title, subtitle, className }: { title: string; subtitle?: string; className?: string }) {
  return (
    <div className={cn("text-center", className)}>
      <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{title}</h1>
      {subtitle ? <p className="mx-auto mt-2 max-w-xs text-base leading-relaxed text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}

/** Ekran tepasidagi belgi (globus, telefon, xat...) — yaltiroq ko'k "ilova belgisi" (premium 2026-10) */
export function EntryIcon({ children }: { children: ReactNode }) {
  return (
    <span className="badge-glossy badge-blue mx-auto flex size-20 items-center justify-center rounded-2xl [&_svg]:size-10" aria-hidden>
      {children}
    </span>
  );
}

/**
 * Birinchi ekrandagi brend kartasi: chuqur ko'k sirt, oq "Ish topdim" belgisi, shior va (bo'lsa) haqiqiy jonli son.
 * Foydalanuvchi ilovani birinchi ochganda nima ekanini va u "tirik" ekanini bir qarashda ko'radi.
 */
export function EntryBrand({ name, slogan, live }: { name: ReactNode; slogan: string; live?: string | null }) {
  return (
    <div className="hero-surface rounded-2xl px-5 py-6 text-center shadow-lg">
      <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-card text-primary shadow-lg [&_svg]:size-[78%]" aria-hidden>
        {/* BrandMark shakli — oq plita ustida ko'k */}
        <svg viewBox="0 0 512 512" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path d="M196 168 V140 A28 28 0 0 1 224 112 H288 A28 28 0 0 1 316 140 V168" strokeWidth="40" />
          <rect x="100" y="168" width="312" height="232" rx="48" strokeWidth="40" />
          <path d="M190 284 L240 332 L326 240" strokeWidth="44" />
        </svg>
      </span>
      <p className="mt-3 text-2xl font-extrabold tracking-tight text-hero-fg">{name}</p>
      <p className="mt-1 text-sm font-semibold text-hero-muted">{slogan}</p>
      {live ? (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-xs font-bold text-foreground shadow-sm">
          <span className="entry-live" aria-hidden />
          {live}
        </p>
      ) : null}
    </div>
  );
}
