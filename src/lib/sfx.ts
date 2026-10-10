/**
 * Ovoz va tebranish effektlari (faqat brauzerda). Fayl yuklanmaydi — tovushlar Web Audio API bilan
 * shu yerning o'zida sintez qilinadi (bir necha o'n millisekund, juda past ovoz balandligi).
 *
 *  - "tap"     — har qanday tugma/havola: mayin "tik"
 *  - "tick"    — ro'yxat elementlari birin-ketin chiqqanda: "tiq-tiq-tiq"
 *  - "pop"     — asosiy tugmalar: "voup" (pastdan yuqoriga sirpanuvchi ton)
 *  - "success" — muvaffaqiyat: uch notali qisqa kuy
 *
 * AudioContext faqat foydalanuvchi birinchi marta bosganda yaratiladi (brauzer qoidasi). Ovozni o'chirish —
 * localStorage "ishuz_sfx" = "off" (yuqori paneldagi tugma). Telegram ichida — telefon tebranishi (HapticFeedback).
 */
export type SfxKind = "tap" | "tick" | "pop" | "success";

const STORAGE_KEY = "ishuz_sfx";
let ctx: AudioContext | null = null;
let enabledCache: boolean | null = null;
// resume() asinxron: bosish paytida chalinadigan ovoz kontekst uyg'onishi bilan chiqadi (keyin to'planib qolmaydi)
let resumeAt = 0;

type TgHaptic = { impactOccurred?: (s: "light" | "medium" | "soft") => void; selectionChanged?: () => void; notificationOccurred?: (t: "success") => void };
function tgHaptic(): TgHaptic | undefined {
  return (window as unknown as { Telegram?: { WebApp?: { HapticFeedback?: TgHaptic } } }).Telegram?.WebApp?.HapticFeedback;
}

export function sfxEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (enabledCache === null) {
    try {
      enabledCache = window.localStorage.getItem(STORAGE_KEY) !== "off";
    } catch {
      enabledCache = true;
    }
  }
  return enabledCache;
}

export function setSfxEnabled(on: boolean): void {
  enabledCache = on;
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    /* maxfiy rejim — faqat shu sahifa uchun */
  }
  window.dispatchEvent(new CustomEvent("ishuz:sfx", { detail: on }));
}

/** Foydalanuvchi bosganda chaqiriladi: ovoz kontekstini yaratadi/uyg'otadi */
export function unlockSfx(): void {
  if (typeof window === "undefined" || !sfxEnabled()) return;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC({ latencyHint: "interactive" });
    }
    if (ctx.state === "suspended") {
      resumeAt = performance.now();
      void ctx.resume().catch(() => undefined);
    }
  } catch {
    ctx = null;
  }
}

function tone(c: AudioContext, at: number, opts: { from: number; to?: number; dur: number; gain: number; type?: OscillatorType }) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.from, at);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, at + opts.dur);
  // tez ko'tarilib, mayin so'nadi — "chirt" emas, yumshoq
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(opts.gain, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + opts.dur);
  osc.connect(g).connect(c.destination);
  osc.start(at);
  osc.stop(at + opts.dur + 0.02);
}

/** Bitta effekt. delayMs — keyinroq (ro'yxat elementlari bilan bir vaqtda) */
export function playSfx(kind: SfxKind, delayMs = 0): void {
  if (typeof window === "undefined" || !sfxEnabled() || !ctx) return;
  if (ctx.state !== "running" && !(ctx.state === "suspended" && performance.now() - resumeAt < 400)) return;
  const at = ctx.currentTime + delayMs / 1000;
  switch (kind) {
    case "tap":
      tone(ctx, at, { from: 1500, to: 1200, dur: 0.03, gain: 0.03, type: "triangle" });
      break;
    case "tick":
      tone(ctx, at, { from: 2300, to: 1700, dur: 0.035, gain: 0.045 });
      break;
    case "pop":
      tone(ctx, at, { from: 240, to: 780, dur: 0.12, gain: 0.08 });
      break;
    case "success":
      [880, 1108.7, 1318.5].forEach((f, i) => tone(ctx!, at + i * 0.075, { from: f, dur: 0.11, gain: 0.05 }));
      break;
  }
  document.documentElement.dataset.sfxLast = kind;
}

/** "tiq-tiq-tiq": ro'yxat elementlari chiqishiga mos ketma-ket (ko'pi bilan 8 ta) */
export function playTicks(count: number, stepMs = 55, startMs = 60): void {
  const n = Math.min(Math.max(count, 0), 8);
  for (let i = 0; i < n; i += 1) playSfx("tick", startMs + i * stepMs);
}

/** Telefon tebranishi: Telegram'da HapticFeedback, Android brauzerda qisqa vibratsiya */
export function haptic(kind: "select" | "impact" | "success"): void {
  if (typeof window === "undefined" || !sfxEnabled()) return;
  const h = tgHaptic();
  if (h) {
    if (kind === "select") h.selectionChanged?.();
    else if (kind === "impact") h.impactOccurred?.("light");
    else h.notificationOccurred?.("success");
    return;
  }
  if (kind !== "select" && typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(kind === "success" ? [12, 40, 12] : 10);
    } catch {
      /* qo'llanmaydi */
    }
  }
}
