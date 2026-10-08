"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, LogIn } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * E'lon berish ramkasi: tepada "Ish qidiryapman · 1/4 — Kasb", o'rtada bitta vazifa,
 * pastda doim BIR XIL joyda "Orqaga" (chapda) va asosiy tugma (o'ngda).
 */
export function WizardFrame({
  title,
  step,
  total,
  stepName,
  loggedIn,
  loginHref,
  onBack,
  backHref,
  onNext,
  nextLabel,
  nextIcon = true,
  pending,
  hideFooter,
  children,
}: {
  title: string;
  step: number;
  total: number;
  stepName: string;
  loggedIn: boolean;
  loginHref: string;
  onBack?: () => void;
  backHref?: string;
  onNext?: () => void;
  nextLabel?: string;
  nextIcon?: boolean;
  pending?: boolean;
  hideFooter?: boolean;
  children: ReactNode;
}) {
  const { t } = useT();
  return (
    <div className="container-narrow pb-44 pt-4 text-lg sm:pt-8">
      <header className="mb-6 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-base font-bold uppercase tracking-wide text-primary">{title}</p>
          {!loggedIn ? (
            <Link href={loginHref} className="inline-flex min-h-12 items-center gap-1.5 rounded-xl px-3 text-base font-semibold text-primary hover:bg-primary-soft">
              <LogIn className="size-5" aria-hidden /> {t("easy.wizard.login")}
            </Link>
          ) : null}
        </div>
        <div>
          <p className="text-xl font-extrabold" aria-live="polite">
            {t("easy.wizard.step_of", { n: step, total, name: stepName })}
          </p>
          <ol className="mt-2 flex gap-1.5" aria-hidden>
            {Array.from({ length: total }, (_, i) => (
              <li key={i} className={cn("h-2 flex-1 rounded-full", i < step ? "bg-primary" : "bg-border")} />
            ))}
          </ol>
        </div>
      </header>

      {children}

      {!hideFooter ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          <div className="container-narrow flex gap-3 py-3">
            {onBack ? (
              <Button type="button" variant="outline" size="xl" className="h-14 min-w-[7.5rem] px-4 text-lg" onClick={onBack} disabled={pending}>
                <ArrowLeft className="size-5" aria-hidden /> {t("easy.wizard.back")}
              </Button>
            ) : (
              <Button asChild variant="outline" size="xl" className="h-14 min-w-[7.5rem] px-4 text-lg">
                <Link href={backHref ?? "/"}>
                  <ArrowLeft className="size-5" aria-hidden /> {t("easy.wizard.back")}
                </Link>
              </Button>
            )}
            {onNext ? (
              <Button type="button" size="xl" className="h-14 min-w-0 flex-1 whitespace-normal px-4 text-lg leading-tight" onClick={onNext} loading={pending}>
                {nextLabel ?? t("easy.wizard.continue")}
                {nextIcon && !pending ? <ArrowRight className="size-5" aria-hidden /> : null}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Xato chiqqanda birinchi qizil yozuvga surib, ekran o'quvchiga ham aytiladi */
export function scrollToError() {
  window.setTimeout(() => document.querySelector('[role="alert"]')?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
}

/** Maydon tagidagi sodda xato matni */
export function FieldError({ id, message }: { id?: string; message?: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-2 rounded-xl bg-destructive-soft px-3 py-2 text-base font-medium text-destructive">
      {message}
    </p>
  );
}

/** Katta, bosiladigan tanlov tugmalari (radio) */
export function ChoiceButtons<T extends string | number>({
  value,
  options,
  onChange,
  label,
  columns = 2,
  invalid,
}: {
  value: T | null;
  options: { value: T; label: string; description?: string }[];
  onChange: (v: T) => void;
  label: string;
  columns?: 1 | 2;
  invalid?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} aria-invalid={invalid || undefined} className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2")}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-lg font-semibold transition-colors",
              on ? "border-primary bg-primary-soft text-foreground" : invalid ? "border-destructive/60 bg-card" : "border-border bg-card hover:border-primary/50",
            )}
          >
            <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border-2", on ? "border-primary" : "border-muted-foreground/50")} aria-hidden>
              {on ? <span className="size-3 rounded-full bg-primary" /> : null}
            </span>
            <span className="min-w-0">
              <span className="block leading-snug">{o.label}</span>
              {o.description ? <span className="block text-base font-normal text-muted-foreground">{o.description}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Tekshirish sahifasidagi qator: nomi, qiymati, "O'zgartirish" */
export function ReviewRow({ label, children, onChange, changeLabel }: { label: string; children: ReactNode; onChange: () => void; changeLabel: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-border py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium text-muted-foreground">{label}</p>
        <div className="mt-0.5 break-words text-lg font-semibold">{children}</div>
      </div>
      <Button type="button" variant="outline" className="h-12 shrink-0 px-3 text-base" onClick={onChange}>
        {changeLabel}
      </Button>
    </div>
  );
}

/** Tanlangan kasb yo'li (soha › guruh › kasb) — keyingi qadamlarda doim ko'rinib turadi */
export function ChosenLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="mb-5 rounded-2xl bg-secondary px-4 py-3 text-base">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-semibold">{value}</span>
    </p>
  );
}

