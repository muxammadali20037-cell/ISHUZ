"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronLeft } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { finishIntro } from "../actions";
import { EntrySubmit } from "./entry-client";

export interface IntroSlide {
  title: string;
  text: string;
  /** faqat haqiqiy (server hisoblagan) son; bo'lmasa — qator chiqmaydi */
  stat: string | null;
  media: ReactNode;
}

/**
 * 3–5-ekranlar: tanishtiruv. "O'tkazib yuborish" (tepada) va "Boshlash" (oxirida) — tanishtiruv shundagina "ko'rilgan" bo'ladi;
 * orqaga — oldingi slayd, birinchisida — til tanlashga. Chap-o'ng tugmalari va barmoq bilan surish ishlaydi.
 */
export function IntroSlides({ slides, initialStep = 0 }: { slides: IntroSlide[]; initialStep?: number }) {
  const { t } = useT();
  const [step, setStep] = useState(Math.min(Math.max(initialStep, 0), slides.length - 1));
  const [dir, setDir] = useState<1 | -1>(1);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const total = slides.length;
  const last = step === total - 1;
  const s = slides[step]!;

  const go = (to: number) => {
    if (to < 0 || to >= total) return;
    setDir(to > step ? 1 : -1);
    setStep(to);
  };
  /** Sahifa hali "jonlanmagan" bo'lsa ham ishlaydi: oddiy havola (?s=), jonlangach — shu joyda almashinadi */
  const slideHref = (i: number) => `/start/tanishtiruv?s=${i + 1}`;
  const goLink = (i: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    go(i);
  };

  return (
    <div
      className="flex min-h-dvh flex-col bg-background sm:items-center sm:justify-center sm:bg-secondary sm:py-8"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(step + 1);
        else if (e.key === "ArrowLeft") go(step - 1);
      }}
    >
      <form
        action={finishIntro}
        aria-label={t("welcome.entry.intro.slides")}
        className="flex w-full flex-1 flex-col pt-[max(0.5rem,env(safe-area-inset-top))] sm:min-h-[min(760px,calc(100dvh-4rem))] sm:max-w-md sm:flex-none sm:rounded-2xl sm:border sm:border-border sm:bg-background sm:shadow-sm"
        onPointerDown={(e) => {
          swipe.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const from = swipe.current;
          swipe.current = null;
          if (!from) return;
          const dx = e.clientX - from.x;
          if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(e.clientY - from.y) * 1.5) go(step + (dx < 0 ? 1 : -1));
        }}
      >
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 px-2">
          {step === 0 ? (
            <Link href="/start/til" aria-label={t("welcome.intro.back")} className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-secondary">
              <ChevronLeft className="size-6" aria-hidden />
            </Link>
          ) : (
            <Link href={slideHref(step - 1)} replace scroll={false} onClick={goLink(step - 1)} aria-label={t("welcome.intro.back")} className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-secondary">
              <ChevronLeft className="size-6" aria-hidden />
            </Link>
          )}
          {!last ? (
            <button type="submit" className="inline-flex min-h-11 items-center rounded-xl px-3 text-base font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground">
              {t("welcome.intro.skip")}
            </button>
          ) : null}
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5">
          <div key={step} className={cn("intro-slide my-auto flex flex-col py-3", dir < 0 && "intro-back")}>
            <div className="mx-auto aspect-[4/3] w-full max-w-sm overflow-hidden rounded-2xl bg-primary-soft">{s.media}</div>
            <p className="sr-only" aria-live="polite">
              {t("welcome.intro.step", { n: step + 1, total })}
            </p>
            <h1 className="mt-7 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{s.title}</h1>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">{s.text}</p>
            {s.stat ? (
              <p className="mt-4 inline-flex items-center gap-2 self-start rounded-full bg-primary-soft px-3 py-1.5 text-sm font-bold text-primary">
                <span className="entry-live" aria-hidden />
                {s.stat}
              </p>
            ) : null}
          </div>
        </div>

        <div className="sticky bottom-0 bg-background px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:rounded-b-2xl">
          <div className="mb-3 flex justify-center gap-1" role="group" aria-label={t("welcome.intro.step", { n: step + 1, total })}>
            {slides.map((_, i) => (
              <Link
                key={i}
                href={slideHref(i)}
                replace
                scroll={false}
                onClick={goLink(i)}
                aria-label={t("welcome.intro.step", { n: i + 1, total })}
                aria-current={i === step ? "step" : undefined}
                className="flex h-11 items-center px-1"
              >
                <span className={cn("block h-2 rounded-full transition-all duration-300", i === step ? "w-7 bg-primary" : "w-2 bg-border")} />
              </Link>
            ))}
          </div>
          {last ? (
            <EntrySubmit>{t("welcome.entry.intro.start")}</EntrySubmit>
          ) : (
            <div className="flex gap-2">
              {step > 0 ? (
                <Button asChild variant="outline" className="h-14 w-14 shrink-0 px-0">
                  <Link href={slideHref(step - 1)} replace scroll={false} onClick={goLink(step - 1)} aria-label={t("welcome.intro.back")}>
                    <ArrowLeft className="size-5" aria-hidden />
                  </Link>
                </Button>
              ) : null}
              <Button asChild className="h-14 flex-1 text-base font-bold">
                <Link href={slideHref(step + 1)} replace scroll={false} onClick={goLink(step + 1)}>
                  {t("welcome.intro.next")} <ArrowRight className="size-5" aria-hidden />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
