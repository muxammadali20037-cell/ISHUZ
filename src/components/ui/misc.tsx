import * as React from "react";
import Link from "next/link";
import { Loader2, ChevronLeft, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-6 animate-spin text-primary", className)} aria-label="Loading" />;
}

function PageSpinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner />
    </div>
  );
}

/** Bo'sh holat: ikonka + sarlavha + tavsif + CTA */
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-12 text-center", className)}>
      {Icon ? (
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Icon className="size-7" />
        </div>
      ) : null}
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? (
        <div className="mt-5">
          {action.href ? (
            <Button asChild>
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ) : (
            <Button onClick={action.onClick}>{action.label}</Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Sahifa sarlavhasi (mobil: orqaga tugmasi bilan) */
function PageHeader({
  title,
  subtitle,
  backHref,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start gap-3", className)}>
      {backHref ? (
        <Link href={backHref} className="-ml-2 mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl hover:bg-secondary" aria-label="Back">
          <ChevronLeft className="size-6" />
        </Link>
      ) : null}
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Qadam ko'rsatkichi: "3 / 8" + progress */
function Stepper({ current, total, label, className }: { current: number; total: number; label?: string; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="tabular font-semibold text-primary">
          {current} / {total}
        </span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i < current ? "bg-primary" : "bg-secondary")} />
        ))}
      </div>
    </div>
  );
}

/** Ma'lumot qatori: ikonka + matn (kartalarda) */
function InfoRow({ icon: Icon, children, className, muted = true }: { icon?: LucideIcon; children: React.ReactNode; className?: string; muted?: boolean }) {
  return (
    <div className={cn("flex items-center gap-1.5 text-sm", muted ? "text-muted-foreground" : "text-foreground", className)}>
      {Icon ? <Icon className="size-4 shrink-0" /> : null}
      <span className="truncate">{children}</span>
    </div>
  );
}

function Separator({ className }: { className?: string }) {
  return <hr className={cn("border-border", className)} />;
}

/** Bo'lim sarlavhasi + "Barchasini ko'rish" havolasi */
function SectionHeader({ title, href, linkLabel, className }: { title: string; href?: string; linkLabel?: string; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-3", className)}>
      <h2 className="text-lg font-bold">{title}</h2>
      {href && linkLabel ? (
        <Link href={href} className="text-sm font-medium text-primary hover:underline">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}

export { Spinner, PageSpinner, EmptyState, PageHeader, Stepper, InfoRow, Separator, SectionHeader };
