"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/client";
import { pickVoice, speakable } from "@/features/assistant/speech";
import type { AssistantLang } from "@/features/assistant/types";
import { speechLang } from "../ai-chat-model";

/*
 * Ovoz (brauzerning o'zi — Web Speech API; bizning serverga ovoz yuborilmaydi va hech qayerda saqlanmaydi):
 *  - useVoice    — gapni matnga aylantirish (mikrofon faqat foydalanuvchi tugmani bosganda va ruxsat berganda);
 *  - useSpeaker  — javobni o'qib berish (qurilmada shu til uchun ovoz bo'lsa), istalgan payt to'xtatiladi.
 * Brauzer qo'llamasa (masalan, Telegram ichidagi oyna) — tugmalar ko'rinmaydi, matnli suhbat ishlayveradi.
 */

const noopSubscribe = () => () => {};

interface SpeechResultList {
  length: number;
  [i: number]: { isFinal: boolean; 0: { transcript: string } };
}
interface SpeechRec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechCtor = new () => SpeechRec;

function speechCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Ovozli kiritish. `onInterim` — gapirilayotgan matn (maydonda jonli ko'rinadi), `onFinal` — tinglash tugaganda yakuniy matn.
 * `lang` — suhbat tili (berilmasa — sayt tili). Xatolar: "denied" — mikrofonga ruxsat yo'q; "failed" — tanib bo'lmadi.
 */
export function useVoice(onInterim: (text: string) => void, onFinal: (text: string) => void, opts?: { continuous?: boolean; lang?: string | null }) {
  const { locale } = useT();
  const supported = useSyncExternalStore(noopSubscribe, () => !!speechCtor(), () => false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<"denied" | "failed" | null>(null);
  const rec = useRef<SpeechRec | null>(null);
  const finalText = useRef("");

  useEffect(() => () => rec.current?.abort(), []);

  const stop = () => rec.current?.stop();
  const start = () => {
    const Ctor = speechCtor();
    if (!Ctor || listening) return;
    setError(null);
    finalText.current = "";
    const r = new Ctor();
    r.lang = speechLang(opts?.lang ?? locale);
    r.interimResults = true;
    // uzun matn (rezyume, vakansiya) — to'xtatilguncha tinglaydi; suhbat — bitta gap
    r.continuous = !!opts?.continuous;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        if (res.isFinal) finalText.current += res[0].transcript;
        else interim += res[0].transcript;
      }
      onInterim((finalText.current + interim).trim());
    };
    r.onerror = (e) => setError(e.error === "not-allowed" || e.error === "service-not-allowed" ? "denied" : e.error === "aborted" || e.error === "no-speech" ? null : "failed");
    r.onend = () => {
      setListening(false);
      rec.current = null;
      const text = finalText.current.trim();
      if (text) onFinal(text);
    };
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setError("failed");
    }
  };
  return { supported, listening, error, start, stop };
}

// --- javobni o'qib berish ---------------------------------------------------------------------------------------------

const SPEAK_KEY = "ib_ai_speak";
const listeners = new Set<() => void>();
/** xotira yopiq bo'lsa (maxfiy rejim) — tanlov shu sahifa ochiq turguncha */
let memory: boolean | null = null;

function subscribeEnabled(l: () => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}
function readEnabled(): boolean {
  if (memory !== null) return memory;
  try {
    return localStorage.getItem(SPEAK_KEY) === "1";
  } catch {
    return false;
  }
}
function writeEnabled(on: boolean) {
  memory = on;
  try {
    if (on) localStorage.setItem(SPEAK_KEY, "1");
    else localStorage.removeItem(SPEAK_KEY);
  } catch {
    // maxfiy rejim — faqat xotirada
  }
  listeners.forEach((l) => l());
}

function synth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined" ? window.speechSynthesis : null;
}

export function useSpeaker() {
  const supported = useSyncExternalStore(noopSubscribe, () => !!synth(), () => false);
  /** "Ovoz bilan javob" yoqilgan (qurilmada eslab qolinadi) */
  const enabled = useSyncExternalStore(subscribeEnabled, readEnabled, () => false);
  const [speaking, setSpeaking] = useState(false);
  /** shu til uchun qurilmada ovoz topilmadi — foydalanuvchiga aytiladi (javob matnda qoladi) */
  const [missing, setMissing] = useState(false);
  const token = useRef(0);

  useEffect(
    () => () => {
      token.current++;
      synth()?.cancel();
    },
    [],
  );

  const stop = useCallback(() => {
    token.current++;
    synth()?.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string, lang: AssistantLang) => {
    const s = synth();
    const phrase = speakable(text);
    if (!s || !phrase) return;
    const my = ++token.current;
    s.cancel();
    const say = (voices: SpeechSynthesisVoice[]) => {
      if (my !== token.current) return;
      const voice = pickVoice(voices, lang);
      if (!voice) {
        setMissing(true);
        setSpeaking(false);
        return;
      }
      setMissing(false);
      const u = new SpeechSynthesisUtterance(phrase);
      u.voice = voice;
      u.lang = voice.lang;
      const end = () => {
        if (my === token.current) setSpeaking(false);
      };
      u.onend = end;
      u.onerror = end;
      setSpeaking(true);
      s.speak(u);
    };
    const now = s.getVoices();
    if (now.length) return say(now);
    // ovozlar ro'yxati kechikib yuklanadi (Chrome): bir marta kutiladi, bo'lmasa — "ovoz yo'q"
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      s.removeEventListener("voiceschanged", done);
      say(s.getVoices());
    };
    s.addEventListener("voiceschanged", done);
    setTimeout(done, 1200);
  }, []);

  /** Yangi javob keldi: "Ovoz bilan javob" yoqilgan bo'lsagina o'qiladi */
  const speakIfEnabled = useCallback(
    (text: string, lang: AssistantLang) => {
      if (readEnabled()) speak(text, lang);
    },
    [speak],
  );

  const setEnabled = useCallback(
    (on: boolean) => {
      writeEnabled(on);
      if (!on) stop();
      else synth()?.getVoices(); // ovozlar ro'yxatini oldindan yuklash
      setMissing(false);
    },
    [stop],
  );

  return { supported, enabled, setEnabled, speaking, missing, speak, speakIfEnabled, stop };
}

export type Speaker = ReturnType<typeof useSpeaker>;
