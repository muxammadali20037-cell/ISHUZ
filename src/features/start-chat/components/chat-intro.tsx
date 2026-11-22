"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, BriefcaseBusiness, Check, ClipboardList, MapPin, Pause, PenLine, Play, RotateCcw, Search, UsersRound, Volume2, VolumeX, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { TOUR_SOUND_KEY } from "@/features/tour/steps";
import { INTRO_COOKIE, INTRO_DONE_EVENT } from "../intro";

/**
 * Chat tepasidagi qisqa video-tushuntirish (ega, 2026-11-22: "tepada kichkina oynada, shu oyna bilan birlashgan, animatsiya
 * bilan — oldida lupa; ovoz yoqishga ruxsat so'rasin, ruxsat bersa ovozli: «Biz sizni ko'rganimizdan mamnunmiz», nima
 * qilish kerak, qanday e'lon joylanadi — hammasini tushuntirsin"). Video fayl emas: sahna animatsiyasi (SVG/CSS, mavzu
 * ranglari) + ovoz (erkak ovozi, faqat o'zbekcha — ega tasdiqlagan matn) + har tilda yozuv (subtitr).
 *  · Birinchi marta — ochiq, "Ovozli tushuntirishni yoqaymi?" (Ha / Ovozsiz). Ovozsiz — yozuv bilan.
 *  · Yopilsa yoki oxirigacha ko'rilsa — cookie (ib_intro_v): keyingi safar yig'ilgan "Qanday ishlaydi?" qatori; shundan
 *    keyin tugmalar bilan tanishuv boshlanadi (ega, 2026-11-22: "tugmalar nima vazifani bajarishini — ovoz bilan"), video
 *    "Ovozsiz" ko'rilgan bo'lsa — tanishuv ham jim.
 *  · Kamroq harakat (prefers-reduced-motion) — sahnalar almashadi, harakatsiz.
 */

/**
 * sahna boshlanish vaqtlari (soniya) — ega yuborgan ovozdagi gaplar boshi bilan bir xil (2026-11-22, "Farruh — Confident",
 * 28.9 s; jimlik oraliqlari bo'yicha o'lchangan). Ovozsiz ko'rilganda ham shu sur'at
 */
const CUES = [0, 3.6, 7.9, 13.85, 21.55, 26.2];
const TOTAL = 29;
/** ovoz fayllari (public/): faqat tayyorlangan tillar — boshqalarda faqat yozuv bilan (kirill o'zbekcha — o'zbekcha ovoz) */
const VOICE: Partial<Record<string, string>> = { uz: "/audio/intro-uz.mp3" };

function remember() {
  document.cookie = `${INTRO_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
  // tugmalar bilan tanishuv (app-tour) — endi boshlanadi
  window.dispatchEvent(new Event(INTRO_DONE_EVENT));
}

type Phase = "ask" | "playing" | "paused" | "ended";

export function ChatIntro({ seen }: { seen: boolean }) {
  const { t, locale } = useT();
  const voice = VOICE[locale === "oz" ? "uz" : locale];
  const [open, setOpen] = useState(!seen);
  const [phase, setPhase] = useState<Phase>("ask");
  const [time, setTime] = useState(0);
  const [muted, setMuted] = useState(true);
  const audio = useRef<HTMLAudioElement | null>(null);
  const clock = useRef<{ last: number; raf: number } | null>(null);

  const stopClock = () => {
    if (clock.current) cancelAnimationFrame(clock.current.raf);
    clock.current = null;
  };
  const finish = useCallback(() => {
    stopClock();
    setPhase("ended");
    setTime(TOTAL);
    remember();
  }, []);

  // ovozsiz: o'z soati; ovozli: soat — ovozning o'zi (sahnalar gap bilan bir vaqtda)
  const timeRef = useRef(0);
  useEffect(() => {
    timeRef.current = time;
  }, [time]);
  useEffect(() => {
    if (phase !== "playing") return stopClock();
    const a = audio.current;
    let last = performance.now();
    const tick = (now: number) => {
      let next: number;
      if (a && !muted) {
        const scale = a.duration && Number.isFinite(a.duration) ? TOTAL / a.duration : 1;
        next = a.currentTime * scale;
      } else {
        next = timeRef.current + (now - last) / 1000;
      }
      last = now;
      if (next >= TOTAL && (muted || !a)) return finish();
      timeRef.current = Math.min(next, TOTAL);
      setTime(timeRef.current);
      clock.current = { last: now, raf: requestAnimationFrame(tick) };
    };
    clock.current = { last, raf: requestAnimationFrame(tick) };
    return stopClock;
  }, [phase, muted, finish]);

  useEffect(() => () => audio.current?.pause(), []);

  const play = (withVoice: boolean) => {
    // birinchi tanlov ("Ha" / "Ovozsiz") — keyingi tugmalar tanishuvida ham shunday (ovozli yoki jim)
    if (phase === "ask" && voice) {
      try {
        localStorage.setItem(TOUR_SOUND_KEY, withVoice ? "1" : "0");
      } catch {
        // xususiy rejim — tanishuv o'z sozlamasi bilan
      }
    }
    const from = phase === "ended" ? 0 : time;
    setTime(from);
    const a = audio.current;
    if (withVoice && a && voice) {
      setMuted(false);
      if (phase === "ended" || phase === "ask") a.currentTime = 0;
      a.play().catch(() => setMuted(true));
    } else {
      setMuted(true);
      a?.pause();
    }
    setPhase("playing");
  };
  const pause = () => {
    audio.current?.pause();
    setPhase("paused");
  };
  const toggleMute = () => {
    const a = audio.current;
    if (!a || !voice) return;
    if (muted) {
      // ovoz vaqti sahna vaqtiga moslanadi
      const scale = a.duration && Number.isFinite(a.duration) ? a.duration / TOTAL : 1;
      a.currentTime = time * scale;
      setMuted(false);
      if (phase === "playing") a.play().catch(() => setMuted(true));
    } else {
      a.pause();
      setMuted(true);
    }
  };
  const close = () => {
    audio.current?.pause();
    stopClock();
    setOpen(false);
    setPhase("ask");
    setTime(0);
    remember();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setPhase("ask");
        }}
        className="press mx-auto flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-sm font-bold text-foreground shadow-sm hover:border-primary/50"
        data-intro-open
      >
        <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Play className="size-3.5" aria-hidden />
        </span>
        {t("easy.intro.how")} <span className="font-semibold text-muted-foreground">· 0:{TOTAL}</span>
      </button>
    );
  }

  const scene = CUES.reduce((acc, c, i) => (time >= c ? i : acc), 0);
  const progress = Math.min(1, time / TOTAL);

  return (
    <section className="overflow-hidden rounded-xl border border-navy-line bg-navy text-navy-foreground shadow-md" aria-label={t("easy.intro.title")} data-intro data-intro-phase={phase}>
      {voice ? <audio ref={audio} src={voice} preload="none" onEnded={finish} /> : null}
      <div className="relative h-44 sm:h-52">
        <Scene index={scene} key={scene} />
        <button type="button" onClick={close} className="press absolute right-1.5 top-1.5 flex size-9 items-center justify-center rounded-lg text-navy-muted hover:bg-navy-2 hover:text-navy-foreground" aria-label={t("common.actions.close")} data-intro-close>
          <X className="size-4" aria-hidden />
        </button>

        {phase === "ask" || phase === "ended" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-navy/90 px-4 text-center" data-intro-ask>
            {phase === "ended" ? (
              <button type="button" onClick={() => play(!muted && !!voice)} className="press inline-flex min-h-11 items-center gap-2 rounded-lg bg-navy-foreground px-4 text-sm font-bold text-navy" data-intro-replay>
                <RotateCcw className="size-4" aria-hidden /> {t("easy.intro.replay")}
              </button>
            ) : voice ? (
              <>
                <p className="text-base font-extrabold">{t("easy.intro.ask_sound")}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={() => play(true)} className="press inline-flex min-h-11 items-center gap-2 rounded-lg bg-navy-foreground px-4 text-sm font-bold text-navy" data-intro-sound="on">
                    <Volume2 className="size-4" aria-hidden /> {t("easy.intro.sound_on")}
                  </button>
                  <button type="button" onClick={() => play(false)} className="press inline-flex min-h-11 items-center gap-2 rounded-lg border border-navy-muted/60 px-4 text-sm font-bold text-navy-foreground" data-intro-sound="off">
                    <VolumeX className="size-4" aria-hidden /> {t("easy.intro.sound_off")}
                  </button>
                </div>
              </>
            ) : (
              <button type="button" onClick={() => play(false)} className="press inline-flex min-h-11 items-center gap-2 rounded-lg bg-navy-foreground px-4 text-sm font-bold text-navy" data-intro-sound="off">
                <Play className="size-4" aria-hidden /> {t("easy.intro.watch")} · 0:{TOTAL}
              </button>
            )}
          </div>
        ) : null}
      </div>

      {/* yozuv (subtitr) — har tilda; ovoz bilan bir vaqtda */}
      <p className="min-h-14 border-t border-navy-line px-3.5 py-2.5 text-sm font-semibold leading-snug" aria-live="polite" data-intro-caption>
        {phase === "ask" ? t("easy.intro.s1") : t(`easy.intro.s${scene + 1}`)}
      </p>

      <div className="flex items-center gap-2.5 border-t border-navy-line px-2.5 py-1.5">
        <button
          type="button"
          onClick={() => (phase === "playing" ? pause() : play(!muted && !!voice))}
          className="press flex size-9 items-center justify-center rounded-lg hover:bg-navy-2"
          aria-label={phase === "playing" ? t("easy.intro.pause") : t("easy.intro.play")}
          data-intro-toggle
        >
          {phase === "playing" ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        </button>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-navy-2" role="progressbar" aria-valuemin={0} aria-valuemax={TOTAL} aria-valuenow={Math.round(time)}>
          <div className="h-full rounded-full bg-hero-accent" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="tabular w-9 text-right text-xs font-semibold text-navy-muted">0:{String(Math.round(time)).padStart(2, "0")}</span>
        {voice ? (
          <button type="button" onClick={toggleMute} className="press flex size-9 items-center justify-center rounded-lg hover:bg-navy-2" aria-label={muted ? t("easy.intro.sound_on") : t("easy.intro.sound_off")} data-intro-mute>
            {muted ? <VolumeX className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
          </button>
        ) : null}
      </div>
    </section>
  );
}

/** Sahnalar: lupa e'lonlarni ko'zdan kechiradi → ilova nomi → ikki tugma → kasb/viloyat va tanlov → e'lon (3 qadam) → pastga yozing */
function Scene({ index }: { index: number }) {
  const { t } = useT();
  const box = "absolute inset-0 flex items-center justify-center gap-4 px-6";
  const card = "intro-pop flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm font-bold text-foreground shadow-sm";
  switch (index) {
    case 0:
      return (
        <div className={box} data-intro-scene="1">
          <div className="relative w-52">
            {[t("easy.intro.demo_job1"), t("easy.intro.demo_job2"), t("easy.intro.demo_job3")].map((label, i) => (
              <div key={label} className={cn(card, "mb-2 opacity-90")} style={{ animationDelay: `${i * 0.15}s` }}>
                <span className="size-3 rounded-sm bg-primary" />
                <span className="truncate">{label}</span>
              </div>
            ))}
            <Search className="intro-scan absolute -left-3 -top-4 size-16 text-highlight drop-shadow" strokeWidth={2.6} aria-hidden />
          </div>
        </div>
      );
    case 1:
      return (
        <div className={cn(box, "flex-col gap-2")} data-intro-scene="2">
          <p className="intro-pop text-2xl font-extrabold tracking-tight">
            Ish <span className="text-hero-accent">topdim</span>
          </p>
          <div className="flex gap-2">
            <span className={card} style={{ animationDelay: ".2s" }}>
              <BriefcaseBusiness className="size-4 text-primary-ink" aria-hidden /> {t("easy.intro.demo_jobs")}
            </span>
            <span className={card} style={{ animationDelay: ".35s" }}>
              <UsersRound className="size-4 text-primary-ink" aria-hidden /> {t("easy.intro.demo_workers")}
            </span>
          </div>
        </div>
      );
    case 2:
      return (
        <div className={cn(box, "flex-col gap-2.5")} data-intro-scene="3">
          <span className="intro-pop intro-tap flex w-56 items-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-extrabold text-primary-foreground">
            <BriefcaseBusiness className="size-4" aria-hidden /> {t("easy.guided.start_jobs")}
          </span>
          <span className="intro-pop flex w-56 items-center gap-2 rounded-lg bg-card px-3 py-2.5 text-sm font-extrabold text-foreground" style={{ animationDelay: ".2s" }}>
            <UsersRound className="size-4 text-primary-ink" aria-hidden /> {t("easy.guided.start_workers")}
          </span>
        </div>
      );
    case 3:
      return (
        <div className={box} data-intro-scene="4">
          <div className="flex flex-col gap-2">
            <span className={card}>{t("easy.intro.demo_prof")}</span>
            <span className={card} style={{ animationDelay: ".25s" }}>
              <MapPin className="size-4 text-primary-ink" aria-hidden /> {t("easy.intro.demo_region")}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <span className={cn(card, "bg-primary text-primary-foreground")} style={{ animationDelay: ".6s" }}>
              <ClipboardList className="size-4" aria-hidden /> {t("easy.intro.demo_see")}
            </span>
            <span className={card} style={{ animationDelay: ".8s" }}>
              <PenLine className="size-4 text-primary-ink" aria-hidden /> {t("easy.intro.demo_post")}
            </span>
          </div>
        </div>
      );
    case 4:
      return (
        <div className={box} data-intro-scene="5">
          <div className="intro-pop w-52 space-y-2 rounded-lg bg-card p-3 text-sm font-bold text-foreground shadow-sm">
            {[t("easy.intro.demo_name"), t("easy.intro.demo_exp"), t("easy.intro.demo_phone")].map((label, i) => (
              <p key={label} className="intro-pop flex items-center gap-2" style={{ animationDelay: `${0.4 + i * 0.5}s` }}>
                <span className="flex size-5 items-center justify-center rounded-md bg-success text-success-foreground">
                  <Check className="size-3.5" aria-hidden />
                </span>
                {label}
              </p>
            ))}
          </div>
        </div>
      );
    default:
      return (
        <div className={cn(box, "flex-col gap-2")} data-intro-scene="6">
          <span className="intro-pop flex w-60 items-center gap-2 rounded-lg bg-card px-3 py-2.5 text-sm font-semibold text-muted-foreground shadow-sm">
            {t("easy.guided.placeholder_guest")}
          </span>
          <ArrowDown className="intro-bob size-8 text-hero-accent" strokeWidth={2.6} aria-hidden />
        </div>
      );
  }
}
