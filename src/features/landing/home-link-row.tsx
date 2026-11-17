import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bosh sahifadagi bitta qator-havola ("E'lonlarim", "Yangi ishlar"): belgi, nom, son, ostida kichik izoh va o'ngda "›".
 * Ega (2026-11-17): "yangi ishlarni bossa — yangi joylangan e'lonlar ichiga kirsin, o'sha oynada ochilmasin; tepasida
 * e'lonlarim tursin — bossa o'zi joylagan e'lonlar ichiga kirsin, holatlarini ko'rsin". Rangsiz — "Bo'limlar" bilan bir xil.
 */
export function HomeLinkRow({
  href,
  icon,
  title,
  hint,
  count,
  name,
  className,
}: {
  href: string;
  /** tayyor belgi: icon={<FileText />} */
  icon: ReactNode;
  title: string;
  hint?: string | null;
  count?: number | null;
  /** testlar va tahlil uchun: data-home-row="…" */
  name: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      data-home-row={name}
      data-track="home_row"
      data-track-to={name}
      className={cn(
        "press flex min-h-16 items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-2.5 shadow-sm hover:bg-secondary/60",
        className,
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground [&>svg]:size-5" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold leading-tight">
          {title}
          {count ? (
            <span data-home-row-count className="ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-secondary px-2 align-middle text-sm font-semibold text-muted-foreground">
              {count > 999 ? "999+" : count}
            </span>
          ) : null}
        </span>
        {hint ? <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{hint}</span> : null}
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
