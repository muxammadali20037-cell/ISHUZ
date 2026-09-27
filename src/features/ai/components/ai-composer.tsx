"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

const MIN_LENGTH = 15;

/** Katta matn maydoni + nima yozish kerakligi haqida maslahatlar + "AI to'ldirsin" */
export function AiComposer({
  title,
  subtitle,
  placeholder,
  hints,
  pending,
  error,
  manualHref,
  manualLabel,
  initialText = "",
  onSubmit,
}: {
  title: string;
  subtitle: string;
  placeholder: string;
  hints: string;
  pending: boolean;
  error: string | null;
  manualHref: string;
  manualLabel: string;
  initialText?: string;
  onSubmit: (text: string) => void;
}) {
  const { t } = useT();
  const [text, setText] = useState(initialText);
  const tooShort = text.trim().length < MIN_LENGTH;

  return (
    <div className="container-narrow py-5 sm:py-8">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
        <Sparkles className="size-3.5" />
        {t("ai.badge")}
      </span>
      <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{title}</h1>
      <p className="mt-1.5 text-[15px] text-muted-foreground">{subtitle}</p>

      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!tooShort && !pending) onSubmit(text.trim());
        }}
      >
        <div className="flex flex-wrap gap-1.5">
          {hints.split("|").map((h) => (
            <span key={h} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">
              <Check className="size-3 text-success" />
              {h.trim()}
            </span>
          ))}
        </div>
        <Textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          maxLength={4000}
          disabled={pending}
          className="min-h-[220px] text-base leading-relaxed"
          aria-label={title}
        />
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : tooShort && text.length > 0 ? (
          <p className="text-xs text-muted-foreground">{t("ai.min_hint")}</p>
        ) : null}

        {pending ? <AnalyzingStatus /> : null}

        <div className="sticky bottom-0 z-30 -mx-4 border-t border-border/70 bg-background/95 px-4 pb-safe pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0">
          <Button type="submit" size="lg" fullWidth loading={pending} disabled={tooShort}>
            {!pending ? <Sparkles className="size-5" /> : null}
            {t("ai.analyze")}
          </Button>
          <Button asChild variant="ghost" size="default" fullWidth className="mt-1 text-muted-foreground">
            <Link href={manualHref}>{manualLabel}</Link>
          </Button>
          <div className="h-2 sm:h-0" />
        </div>
      </form>
    </div>
  );
}

/** Kutish paytida almashinib turadigan holat matnlari (AI 10–30 soniya ishlashi mumkin) */
function AnalyzingStatus() {
  const { t } = useT();
  const steps = t("ai.analyzing").split("|").map((s) => s.trim());
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => Math.min(n + 1, steps.length - 1)), 3500);
    return () => clearInterval(id);
  }, [steps.length]);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary-soft/50 p-4" role="status" aria-live="polite">
      <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Sparkles className="size-5 animate-pulse" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{steps[i]}</p>
        <div className="mt-2 flex gap-1">
          {steps.map((s, n) => (
            <span key={s} className={cn("h-1 flex-1 rounded-full transition-colors duration-500", n <= i ? "bg-primary" : "bg-primary/20")} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** "AI bilan to'ldirish" taklif kartasi (wizard boshida) */
export function AiCtaCard({ title, description, href }: { title: string; description: string; href: string }) {
  const { t } = useT();
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary-soft to-card p-4 transition-colors hover:border-primary/60"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Sparkles className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-snug">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </span>
      <span className="hidden shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground group-hover:bg-primary-hover sm:inline">{t("ai.open")}</span>
    </Link>
  );
}
