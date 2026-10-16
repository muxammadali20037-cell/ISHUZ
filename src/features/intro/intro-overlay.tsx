"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, UsersRound } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { callAction } from "@/lib/action-call";
import { DOCUMENT_COOKIE_ATTRS } from "@/lib/security/cookies";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/shared/brand-mark";
import { BrandWordmark } from "@/components/shared/brand-wordmark";
import { WindowArtwork } from "@/features/home-windows/window-art";
import { chooseMode } from "@/features/mode/actions";
import type { AppMode } from "@/features/mode/mode";
import { cn } from "@/lib/utils";
import { INTRO_COOKIE } from "./intro";
import { MatchArt } from "./intro-art";

const STEPS = 3;
const num = (n: number) => new Intl.NumberFormat("ru-RU").format(n);

/**
 * Birinchi ochilishdagi tanishtiruv (3 qadam): ish topish → ishchi topish → sizga mosini topamiz + rol tanlash.
 * - bir marta: ochilishi bilan `ib_intro` cookie yoziladi (qayta yuklansa ham chiqmaydi);
 * - "O'tkazib yuborish", "Oldingi/Keyingi", nuqtalar, chap-o'ng tugmalari va barmoq surish ishlaydi;
 * - raqamlar faqat haqiqiy (server hisoblagan); bo'lmasa — qator chiqmaydi.
 */
export function IntroOverlay({ stats }: { stats: { vacancies: number; workers: number } | null }) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [pending, start] = useTransition();
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.cookie = `${INTRO_COOKIE}=1; max-age=${60 * 60 * 24 * 365}${DOCUMENT_COOKIE_ATTRS}`;
  }, []);

  const go = (to: number) => {
    if (to < 0 || to >= STEPS) return;
    setDir(to > step ? 1 : -1);
    setStep(to);
  };
  const choose = (mode: AppMode) =>
    start(async () => {
      const res = await callAction(() => chooseMode(mode));
      if (!res.ok) {
        toast.error(t("common.errors.generic"));
        return;
      }
      router.refresh();
      setOpen(false);
    });

  const slides = [
    { art: <WindowArtwork art="jobs" cover />, title: t("welcome.intro.s1_title"), text: t("welcome.intro.s1_text"), stat: stats && stats.vacancies > 0 ? t("welcome.intro.s1_stat", { count: num(stats.vacancies) }) : null },
    { art: <WindowArtwork art="workers" cover />, title: t("welcome.intro.s2_title"), text: t("welcome.intro.s2_text"), stat: stats && stats.workers > 0 ? t("welcome.intro.s2_stat", { count: num(stats.workers) }) : null },
    { art: <MatchArt />, title: t("welcome.intro.s3_title"), text: t("welcome.intro.s3_text"), stat: null },
  ];
  const s = slides[step]!;
  const last = step === STEPS - 1;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => (pending ? undefined : setOpen(v))}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 sm:data-[state=open]:animate-in sm:data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          ref={content}
          data-testid="intro"
          // fokus oynaning o'ziga (birinchi tugma atrofida ramka chiqmasin); Tab bilan tugmalarga o'tiladi, chap-o'ng ishlaydi
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            content.current?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") go(step + 1);
            else if (e.key === "ArrowLeft") go(step - 1);
          }}
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
          className={cn(
            "fixed inset-0 z-50 flex flex-col bg-background pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] outline-none",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(720px,92dvh)] sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:shadow-lg",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-200",
          )}
        >
          <div className="flex items-center justify-between gap-3 px-4">
            <span className="flex items-center gap-2 text-lg font-extrabold" aria-hidden>
              <BrandMark className="size-8" />
              <span>
                <BrandWordmark />
              </span>
            </span>
            {!last ? (
              <button type="button" onClick={() => go(STEPS - 1)} className="inline-flex min-h-11 items-center rounded-xl px-3 text-base font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground">
                {t("welcome.intro.skip")}
              </button>
            ) : (
              <span className="min-h-11" />
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5">
            <div key={step} className={cn("intro-slide my-auto flex flex-col py-3", dir < 0 && "intro-back")}>
              <div className="mx-auto aspect-[16/11] w-full max-w-sm overflow-hidden rounded-2xl" aria-hidden>
                {s.art}
              </div>
              <p className="sr-only" aria-live="polite">
                {t("welcome.intro.step", { n: step + 1, total: STEPS })}
              </p>
              <DialogPrimitive.Title className="mt-6 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{s.title}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-2 text-base leading-relaxed text-muted-foreground">{s.text}</DialogPrimitive.Description>
              {s.stat ? (
                <p className="mt-4 inline-flex items-center gap-2 self-start rounded-full bg-primary-soft px-3 py-1.5 text-sm font-bold text-primary">
                  <span className="entry-live" aria-hidden />
                  {s.stat}
                </p>
              ) : null}
            </div>
          </div>

          <div className="px-5 pt-3">
            <div className="mb-4 flex justify-center gap-1.5" role="group" aria-label={t("welcome.intro.step", { n: step + 1, total: STEPS })}>
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={t("welcome.intro.step", { n: i + 1, total: STEPS })}
                  aria-current={i === step ? "step" : undefined}
                  className="flex h-11 items-center px-1"
                >
                  <span className={cn("block h-2 rounded-full transition-all duration-300", i === step ? "w-7 bg-primary" : "w-2 bg-border")} />
                </button>
              ))}
            </div>
            {last ? (
              <div className="grid gap-2">
                <Button className="h-14 text-base font-bold" onClick={() => choose("worker")} loading={pending} data-track="intro_role" data-track-to="worker">
                  <BriefcaseBusiness className="size-5" aria-hidden /> {t("welcome.intro.choose_worker")}
                </Button>
                <Button variant="outline" className="h-14 text-base font-bold" onClick={() => choose("employer")} disabled={pending} data-track="intro_role" data-track-to="employer">
                  <UsersRound className="size-5" aria-hidden /> {t("welcome.intro.choose_employer")}
                </Button>
                <div className="flex items-center justify-between gap-2">
                  <button type="button" onClick={() => go(step - 1)} className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-base font-semibold text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="size-4" aria-hidden /> {t("welcome.intro.back")}
                  </button>
                  <DialogPrimitive.Close className="inline-flex min-h-11 items-center rounded-xl px-2 text-base font-semibold text-primary hover:underline" disabled={pending}>
                    {t("welcome.intro.later")}
                  </DialogPrimitive.Close>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                {step > 0 ? (
                  <Button variant="outline" className="h-14 w-14 shrink-0 px-0" onClick={() => go(step - 1)} aria-label={t("welcome.intro.back")}>
                    <ArrowLeft className="size-5" aria-hidden />
                  </Button>
                ) : null}
                <Button className="h-14 flex-1 text-base font-bold" onClick={() => go(step + 1)}>
                  {t("welcome.intro.next")} <ArrowRight className="size-5" aria-hidden />
                </Button>
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
