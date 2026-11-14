"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Dialog as DialogPrimitive } from "radix-ui";
import { ChevronLeft, ChevronRight, ExternalLink, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { track } from "@/features/analytics/client";
import { BrandMark } from "@/components/shared/brand-mark";
import { cn } from "@/lib/utils";
import { isInternalCta, type Story } from "../model";

/** Bosib turish shu vaqtdan oshsa — pauza (qo'yib yuborilsa davom etadi), aks holda — bosish (oldinga/orqaga) */
const HOLD_MS = 220;
/** Pastga shuncha surilsa — yopiladi */
const SWIPE_CLOSE_PX = 90;

/**
 * To'liq ekranli ko'rish (Instagram'dagidek): tepada bo'laklangan jarayon chizig'i, o'ng tomonga bosish — keyingisi, chapga —
 * oldingisi, bosib turish — pauza, pastga surish yoki ✕ — yopish. Klaviatura: ← → , bo'sh joy — pauza, Esc — yopish.
 * Rasm `durationSec` turadi, video — o'z uzunligicha (avval ovoz bilan, brauzer ruxsat bermasa — ovozsiz, 🔊 tugmasi bilan).
 */
export function StoryViewer({
  stories,
  start,
  onSeen,
  onClose,
}: {
  stories: Story[];
  start: number;
  onSeen: (id: string) => void;
  onClose: (lastId: string | null) => void;
}) {
  const { t } = useT();
  const [index, setIndex] = useState(() => Math.min(Math.max(0, start), stories.length - 1));
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  // yuklanish holati hikoya id'siga bog'langan — boshqasiga o'tilganda o'zi "yuklanmagan" bo'ladi (effektda tozalash shart emas)
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [brokenId, setBrokenId] = useState<string | null>(null);
  const story = stories[index]!;
  const ready = loadedId === story.id;
  const failed = brokenId === story.id;
  const fill = useRef<HTMLSpanElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const elapsed = useRef(0);
  const press = useRef<{ x: number; y: number; timer: number | null; held: boolean } | null>(null);

  const setFill = (p: number) => {
    if (fill.current) fill.current.style.transform = `scaleX(${Math.max(0, Math.min(1, p))})`;
  };

  const close = useCallback(() => onClose(stories[index]?.id ?? null), [onClose, stories, index]);
  const next = useCallback(() => {
    if (index < stories.length - 1) setIndex(index + 1);
    else close();
  }, [index, stories.length, close]);
  const prev = useCallback(() => {
    if (index > 0) {
      setIndex(index - 1);
      return;
    }
    // birinchisida — boshidan
    elapsed.current = 0;
    setFill(0);
    if (video.current) video.current.currentTime = 0;
  }, [index]);

  // har yangi hikoya: ko'rildi deb belgilash, statistika, keyingi rasmni oldindan yuklash
  useEffect(() => {
    elapsed.current = 0;
    setFill(0);
    onSeen(story.id);
    track("story_view", { id: story.id });
    const after = stories[index + 1];
    if (after?.kind === "image") {
      const img = new Image();
      img.src = after.mediaUrl;
    }
  }, [story.id, index, stories, onSeen]);

  // rasm: vaqt bo'yicha (pauza va yuklanish hisobga olinadi)
  useEffect(() => {
    if (story.kind !== "image" || paused || !ready || failed) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      elapsed.current += now - last;
      last = now;
      const p = elapsed.current / (story.durationSec * 1000);
      setFill(p);
      if (p >= 1) next();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [story, paused, ready, failed, next]);

  // video: o'ynatish/pauza va silliq jarayon chizig'i
  useEffect(() => {
    const v = video.current;
    if (story.kind !== "video" || !v || failed) return;
    if (paused) {
      v.pause();
      return;
    }
    v.muted = muted;
    v.play().catch(() => {
      // brauzer ovozli avto-o'ynatishga ruxsat bermadi — ovozsiz davom etadi (🔊 tugmasi bilan yoqiladi)
      if (!v.muted) {
        setMuted(true);
        v.muted = true;
        void v.play().catch(() => setPaused(true));
      } else setPaused(true);
    });
    let raf = 0;
    const tick = () => {
      if (v.duration > 0) setFill(v.currentTime / v.duration);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [story.id, story.kind, paused, muted, failed]);

  // boshqa ilovaga o'tilsa — pauza
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) setPaused(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = { x: e.clientX, y: e.clientY, held: false, timer: null as number | null };
    p.timer = window.setTimeout(() => {
      p.held = true;
      setPaused(true);
    }, HOLD_MS);
    press.current = p;
  };
  const endPress = (e: React.PointerEvent, cancelled = false) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    if (p.timer) window.clearTimeout(p.timer);
    if (p.held) {
      setPaused(false);
      return;
    }
    if (cancelled) return;
    if (e.clientY - p.y > SWIPE_CLOSE_PX) {
      close();
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientX - rect.left < rect.width * 0.3) prev();
    else next();
  };

  const cta = story.ctaUrl && story.ctaLabel ? { url: story.ctaUrl, label: story.ctaLabel } : null;
  const onCta = () => track("story_cta", { id: story.id });

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => (o ? undefined : close())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/95" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          data-story-viewer
          data-story-index={index}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") next();
            else if (e.key === "ArrowLeft") prev();
            else if (e.key === " " && (e.target as HTMLElement).tagName !== "BUTTON" && (e.target as HTMLElement).tagName !== "A") {
              e.preventDefault();
              setPaused((x) => !x);
            }
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center outline-none"
        >
          <DialogPrimitive.Title className="sr-only">{story.title}</DialogPrimitive.Title>
          {/* kompyuterda — ramka yonida oldingi/keyingi */}
          <button
            type="button"
            onClick={prev}
            aria-label={t("easy.stories.prev")}
            className="mr-3 hidden size-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 disabled:opacity-0 md:flex"
            disabled={index === 0}
          >
            <ChevronLeft className="size-6" aria-hidden />
          </button>
          <div className="relative h-dvh w-full overflow-hidden bg-black md:aspect-[9/16] md:h-[min(100dvh-2rem,56rem)] md:w-auto md:rounded-2xl">
            {/* media */}
            {failed ? (
              <p role="alert" className="absolute inset-0 flex items-center justify-center px-8 text-center text-base text-white/80">
                {t("easy.stories.failed")}
              </p>
            ) : story.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element -- storage'dagi tayyor WebP; to'liq ekran, asl nisbatda
              <img
                key={story.id}
                src={story.mediaUrl}
                alt={story.caption ?? story.title}
                draggable={false}
                onLoad={() => setLoadedId(story.id)}
                onError={() => setBrokenId(story.id)}
                className="absolute inset-0 size-full select-none object-contain"
              />
            ) : (
              <video
                key={story.id}
                ref={video}
                src={story.mediaUrl}
                poster={story.posterUrl ?? undefined}
                playsInline
                preload="auto"
                onLoadedData={() => setLoadedId(story.id)}
                onEnded={next}
                onError={() => setBrokenId(story.id)}
                className="absolute inset-0 size-full object-contain"
                aria-label={story.caption ?? story.title}
              />
            )}
            {!ready && !failed ? <span className="absolute left-1/2 top-1/2 size-9 -translate-x-1/2 -translate-y-1/2 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" aria-hidden /> : null}

            {/* bosish/surish qatlami: chap 30% — oldingi, qolgani — keyingi; bosib turish — pauza */}
            <div
              data-story-tap
              className="absolute inset-0 z-10 touch-none select-none"
              onPointerDown={onPointerDown}
              onPointerUp={(e) => endPress(e)}
              onPointerCancel={(e) => endPress(e, true)}
              onContextMenu={(e) => e.preventDefault()}
              aria-hidden
            />

            {/* tepa: jarayon, belgi, nom va tugmalar */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-linear-to-b from-black/60 to-transparent px-3 pb-8 pt-[max(0.625rem,env(safe-area-inset-top))]">
              <div className="flex gap-1" aria-hidden>
                {stories.map((s, i) => (
                  <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/35">
                    <span
                      ref={i === index ? fill : undefined}
                      className="block h-full origin-left bg-white"
                      style={{ transform: `scaleX(${i < index ? 1 : 0})` }}
                    />
                  </span>
                ))}
              </div>
              <p className="sr-only" aria-live="polite">
                {t("easy.stories.counter", { n: index + 1, total: stories.length })}
              </p>
              <div className="mt-2.5 flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white">
                  <BrandMark className="size-7" sizes="32px" />
                </span>
                <div className="min-w-0 flex-1 text-white">
                  <p className="text-sm font-bold leading-tight">{t("easy.stories.brand")}</p>
                  <p className="truncate text-xs leading-tight text-white/80">{story.title}</p>
                </div>
                <div className="pointer-events-auto flex items-center">
                  {story.kind === "video" ? (
                    <button
                      type="button"
                      onClick={() => setMuted((m) => !m)}
                      aria-label={muted ? t("easy.stories.unmute") : t("easy.stories.mute")}
                      aria-pressed={!muted}
                      data-story-mute
                      className="flex size-11 items-center justify-center rounded-full text-white hover:bg-white/15"
                    >
                      {muted ? <VolumeX className="size-5" aria-hidden /> : <Volume2 className="size-5" aria-hidden />}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setPaused((p) => !p)}
                    aria-label={paused ? t("easy.stories.play") : t("easy.stories.pause")}
                    data-story-pause
                    className="flex size-11 items-center justify-center rounded-full text-white hover:bg-white/15"
                  >
                    {paused ? <Play className="size-5" aria-hidden /> : <Pause className="size-5" aria-hidden />}
                  </button>
                  <DialogPrimitive.Close
                    aria-label={t("easy.stories.close")}
                    data-story-close
                    className="flex size-11 items-center justify-center rounded-full text-white hover:bg-white/15"
                  >
                    <X className="size-6" aria-hidden />
                  </DialogPrimitive.Close>
                </div>
              </div>
            </div>

            {/* past: matn va reklama tugmasi */}
            {story.caption || cta ? (
              <div className="absolute inset-x-0 bottom-0 z-20 bg-linear-to-t from-black/75 via-black/40 to-transparent px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-12">
                {story.caption ? <p className="whitespace-pre-line text-base leading-snug text-white [overflow-wrap:anywhere]">{story.caption}</p> : null}
                {cta ? (
                  isInternalCta(cta.url) ? (
                    <Link
                      href={cta.url}
                      onClick={onCta}
                      data-story-cta
                      className={cn("press mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-base font-bold text-navy hover:bg-white/90")}
                    >
                      {cta.label} <ChevronRight className="size-5" aria-hidden />
                    </Link>
                  ) : (
                    <a
                      href={cta.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={onCta}
                      data-story-cta
                      className="press mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-base font-bold text-navy hover:bg-white/90"
                    >
                      {cta.label} <ExternalLink className="size-5" aria-hidden />
                    </a>
                  )
                ) : null}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={next}
            aria-label={t("easy.stories.next")}
            className="ml-3 hidden size-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 md:flex"
          >
            <ChevronRight className="size-6" aria-hidden />
          </button>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
