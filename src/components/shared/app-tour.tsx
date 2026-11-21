"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { Volume2, VolumeX } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { DOCUMENT_COOKIE_ATTRS } from "@/lib/security/cookies";
import { Button } from "@/components/ui/button";
import { TOUR_AUDIO, TOUR_COOKIE, TOUR_DONE_EVENT, TOUR_STEPS, markTourSeen, tourAudioSrc, tourSeen, type TourPanel, type TourStep } from "@/features/tour/steps";

/**
 * Birinchi kirgandagi tanishtiruv (features/tour/steps.ts): bosh sahifada, xush kelibsiz ekranidan keyin, har panel uchun
 * bir marta. Fon xiralashadi, navbatdagi tugma yoritiladi, yonida — nomi va vazifasi; ovoz yozilgan bo'lsa — o'qiladi.
 * "?tour=1" — qayta ko'rsatadi (yordam sahifasidan). Telegram kanali taklifi tanishtiruv tugagach chiqadi (channel-prompt).
 */
const START_DELAY_MS = 900;
const SOUND_KEY = "ishuz:tour-sound";
const PAD = 6;
const GAP = 14;

function readCookie(name: string): string | null {
  const row = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return row ? decodeURIComponent(row.slice(name.length + 1)) : null;
}

/** html[data-panel] — rol almashganda (router.refresh) ham kuzatiladi */
function subscribePanel(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-panel"] });
  return () => mo.disconnect();
}
const getPanel = (): TourPanel => (document.documentElement.dataset.panel === "employer" ? "employer" : "worker");
const getServerPanel = (): TourPanel => "worker";

function findTarget(id: string): HTMLElement | null {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`))) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden") return el;
  }
  return null;
}

function isFixed(el: HTMLElement): boolean {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    const p = getComputedStyle(n).position;
    if (p === "fixed" || p === "sticky") return true;
  }
  return false;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Running {
  panel: TourPanel;
  steps: TourStep[];
  i: number;
}

export function AppTour() {
  const { t, locale } = useT();
  const pathname = usePathname();
  const panel = useSyncExternalStore(subscribePanel, getPanel, getServerPanel);
  const [run, setRun] = useState<Running | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [sound, setSound] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const hasAudio = !!TOUR_AUDIO[locale === "oz" ? "uz" : (locale as "uz" | "ru" | "en")]?.length;

  // boshlash: asosiy ekran (chat: mehmonda "/", kirganda "/chat"), shu panel uchun hali ko'rilmagan (yoki ?tour=1). Ekranda
  // yo'q tugmaning qadami o'tkazib yuboriladi. 2026-11-21: xush kelibsiz ekrani endi birinchi ochilishda yo'q — "ib_intro"
  // kutilmaydi (ega: "tanishtiruvni qaytar"); kanal oynasi tanishtiruv tugagach chiqadi
  useEffect(() => {
    if (pathname !== "/" && pathname !== "/chat") return;
    const forced = new URLSearchParams(window.location.search).get("tour") === "1";
    if (!forced && tourSeen(readCookie(TOUR_COOKIE), panel)) return;
    let tries = 0;
    let timer = 0;
    const start = () => {
      // rol almashish ekrani (role-switch-splash) hali ko'rinib turgan bo'lsa — kutamiz
      if (document.querySelector(".role-splash") && tries++ < 10) {
        timer = window.setTimeout(start, 400);
        return;
      }
      const steps = TOUR_STEPS[panel].filter((s) => !s.target || findTarget(s.target));
      try {
        setSound(localStorage.getItem(SOUND_KEY) !== "0");
      } catch {
        /* xususiy rejim */
      }
      setRun({ panel, steps, i: 0 });
    };
    timer = window.setTimeout(start, START_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [pathname, panel]);

  const step = run ? run.steps[run.i] : undefined;

  // yoritiladigan tugma o'lchami (aylantirish, o'lcham o'zgarishi)
  useEffect(() => {
    if (!step) return;
    document.documentElement.dataset.tour = "open";
    const el = step.target ? findTarget(step.target) : null;
    if (el && !isFixed(el)) el.scrollIntoView({ block: "center", behavior: "auto" });
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!el) return setBox(null);
        const r = el.getBoundingClientRect();
        setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
      });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    primaryRef.current?.focus({ preventScroll: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step]);

  // ovoz: har qadamda o'sha tildagi yozuv (bo'lsa); brauzer ruxsat bermasa — jim
  useEffect(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (!step || !sound) return;
    const src = tourAudioSrc(locale, step.code);
    if (!src) return;
    const a = new Audio(src);
    audioRef.current = a;
    a.play().catch(() => undefined);
    return () => a.pause();
  }, [step, sound, locale]);

  if (!run || !step) return null;

  const finish = () => {
    audioRef.current?.pause();
    document.cookie = `${TOUR_COOKIE}=${markTourSeen(readCookie(TOUR_COOKIE), run.panel)}; max-age=${365 * 24 * 3600}${DOCUMENT_COOKIE_ATTRS}`;
    delete document.documentElement.dataset.tour;
    setRun(null);
    setBox(null);
    window.dispatchEvent(new Event(TOUR_DONE_EVENT));
  };
  const go = (d: number) => {
    const i = run.i + d;
    if (i >= run.steps.length) return finish();
    if (i >= 0) setRun({ ...run, i });
  };
  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    try {
      localStorage.setItem(SOUND_KEY, next ? "1" : "0");
    } catch {
      /* xususiy rejim */
    }
  };

  const first = run.i === 0;
  const last = run.i === run.steps.length - 1;
  const copy = { title: t(`easy.tour.steps.${step.code}.title`), text: t(`easy.tour.steps.${step.code}.text`) };

  // karta: tugma pastki yarmida bo'lsa — uning ustida, aks holda — ostida; o'rtadagi qadamlarda — ekran markazida
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const vw = typeof window === "undefined" ? 400 : window.innerWidth;
  const cardW = Math.min(vw - 32, 352);
  let cardStyle: CSSProperties = { width: cardW, left: (vw - cardW) / 2, top: "50%", transform: "translateY(-50%)" };
  if (box && step.target) {
    const left = Math.min(Math.max(box.left + box.width / 2 - cardW / 2, 16), vw - cardW - 16);
    cardStyle = box.top + box.height / 2 > vh / 2 ? { width: cardW, left, bottom: vh - box.top + GAP } : { width: cardW, left, top: box.top + box.height + GAP };
  }

  return (
    <div className="fixed inset-0 z-[70]" data-tour-overlay onKeyDown={(e) => e.key === "Escape" && finish()}>
      {/* fon: yoritilgan tugma atrofida "teshik" (soya bilan), qolgani xira */}
      {box && step.target ? (
        <div
          aria-hidden
          data-tour-spot={step.target}
          className="pointer-events-none fixed rounded-2xl ring-2 ring-primary transition-all duration-300 [box-shadow:0_0_0_9999px_rgb(0_0_0/0.6)] motion-reduce:transition-none"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-black/60" />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={`${titleId}-text`}
        className="fixed rounded-2xl bg-card p-4 text-card-foreground shadow-lg transition-[top,bottom,left] duration-300 motion-reduce:transition-none"
        style={cardStyle}
        data-tour-card={step.code}
      >
        <div className="flex items-center gap-2">
          <p className="mr-auto text-xs font-semibold text-muted-foreground" aria-label={t("easy.tour.label")}>
            {t("easy.tour.step", { n: run.i + 1, total: run.steps.length })}
          </p>
          {/* "O'tkazib yuborish" — tepada (pastda "Orqaga · Keyingi" bilan sig'masdi); birinchi qadamda — pastda "Kerak emas" */}
          {!first && !last ? (
            <button type="button" onClick={finish} className="press -my-2 min-h-11 whitespace-nowrap rounded-xl px-1 text-sm font-semibold text-muted-foreground hover:text-foreground" data-tour-skip>
              {t("easy.tour.skip")}
            </button>
          ) : null}
          {hasAudio ? (
            <button
              type="button"
              onClick={toggleSound}
              aria-pressed={sound}
              aria-label={sound ? t("easy.tour.sound_off") : t("easy.tour.sound_on")}
              className="press -m-1 flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
            >
              {sound ? <Volume2 className="size-5" aria-hidden /> : <VolumeX className="size-5" aria-hidden />}
            </button>
          ) : null}
        </div>
        <h2 id={titleId} className="mt-1 text-lg font-bold leading-snug">
          {copy.title}
        </h2>
        <p id={`${titleId}-text`} className="mt-1 text-base text-muted-foreground" aria-live="polite">
          {copy.text}
        </p>
        <div className="mt-4 flex items-center gap-2">
          {first ? (
            <button type="button" onClick={finish} className="press min-h-11 whitespace-nowrap rounded-xl px-2 text-sm font-semibold text-muted-foreground hover:text-foreground" data-tour-skip>
              {t("easy.tour.later")}
            </button>
          ) : !last ? (
            <Button type="button" variant="outline" className="h-11 px-4 text-base" onClick={() => go(-1)}>
              {t("easy.tour.back")}
            </Button>
          ) : null}
          <Button ref={primaryRef} type="button" className="ml-auto h-11 min-w-28 px-5 text-base" onClick={() => go(1)} data-tour-next>
            {first ? t("easy.tour.start") : last ? t("easy.tour.done") : t("easy.tour.next")}
          </Button>
        </div>
      </div>
    </div>
  );
}
