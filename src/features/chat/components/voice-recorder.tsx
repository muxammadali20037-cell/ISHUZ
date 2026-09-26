"use client";

import { useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { toast } from "@/components/ui/toast";
import { MAX_VOICE_SECONDS } from "../schema";
import { formatDuration } from "../utils";

/** Bucket qabul qiladigan (audio/webm | audio/ogg) va brauzer yoza oladigan MIME; bo'lmasa null → tugma yashiriladi */
export function pickRecorderMime(): string | null {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"]) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      // ba'zi brauzerlar isTypeSupported'da xato beradi
    }
  }
  return null;
}

/**
 * Ovozli xabar yozish paneli: mount bo'lganda mikrofonni so'raydi, taymer ko'rsatadi.
 * "Yuborish" → onFinish(blob, mime, soniya); "Bekor" → onCancel().
 */
export function VoiceRecorder({ mimeType, onCancel, onFinish }: { mimeType: string; onCancel: () => void; onFinish: (blob: Blob, mime: string, seconds: number) => void }) {
  const { t } = useT();
  const [seconds, setSeconds] = useState(0);
  const [ready, setReady] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const cancelledRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onFinishRef.current = onFinish;
    onCancelRef.current = onCancel;
  }, [onFinish, onCancel]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    const baseMime = mimeType.split(";")[0] ?? mimeType;

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const recorder = new MediaRecorder(stream, { mimeType });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((track) => track.stop());
          if (cancelledRef.current) return;
          const blob = new Blob(chunksRef.current, { type: baseMime });
          const elapsed = (Date.now() - startedAtRef.current) / 1000;
          onFinishRef.current(blob, baseMime, elapsed);
        };
        recorder.start(250);
        startedAtRef.current = Date.now();
        recorderRef.current = recorder;
        setReady(true);
        timer = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
          setSeconds(elapsed);
          if (elapsed >= MAX_VOICE_SECONDS && recorder.state === "recording") recorder.stop();
        }, 250);
      })
      .catch(() => {
        if (!active) return;
        toast.error(t("chat.composer.mic_denied"));
        onCancelRef.current();
      });

    return () => {
      active = false;
      if (timer) clearInterval(timer);
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        cancelledRef.current = true;
        rec.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [mimeType, t]);

  const cancel = () => {
    cancelledRef.current = true;
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    else streamRef.current?.getTracks().forEach((track) => track.stop());
    onCancel();
  };

  const finish = () => {
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") return;
    if (Date.now() - startedAtRef.current < 700) {
      toast.error(t("chat.composer.voice_too_short"));
      cancel();
      return;
    }
    rec.stop();
  };

  return (
    <div className="flex items-center gap-2" role="group" aria-label={t("chat.composer.recording")}>
      <button
        type="button"
        onClick={cancel}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
        aria-label={t("chat.composer.cancel")}
      >
        <X className="size-5" />
      </button>
      <div className="flex h-11 flex-1 items-center gap-2 rounded-2xl bg-destructive-soft px-4 text-destructive">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-destructive" />
        </span>
        <span className="text-sm font-semibold">{t("chat.composer.recording")}</span>
        <span className="ml-auto text-sm font-semibold tabular">{formatDuration(seconds)}</span>
      </div>
      <button
        type="button"
        onClick={finish}
        disabled={!ready}
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover disabled:opacity-50"
        aria-label={t("chat.composer.stop")}
      >
        <Send className="size-5" />
      </button>
    </div>
  );
}
