"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent, type KeyboardEvent } from "react";
import { Ban, FileText, Image as ImageIcon, MapPin, Mic, Paperclip, Send } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { DOCUMENT_MIMES, IMAGE_MIMES } from "../schema";
import { pickRecorderMime, VoiceRecorder } from "./voice-recorder";

export interface ComposerProps {
  disabled?: boolean;
  disabledNotice?: string;
  disabledAction?: { label: string; onClick: () => void; loading?: boolean };
  /** true qaytarsa — matn maydoni tozalanadi */
  onSendText: (text: string) => Promise<boolean>;
  onSendFile: (file: File, kind: "image" | "document") => Promise<void>;
  onSendVoice: (blob: Blob, mime: string, seconds: number) => Promise<void>;
  onSendLocation: (lat: number, lng: number) => Promise<void>;
}

const MAX_TEXTAREA_PX = 160;
const noopSubscribe = () => () => {};
const getIsTouch = () => navigator.maxTouchPoints > 0 || "ontouchstart" in window;

export function Composer({ disabled, disabledNotice, disabledAction, onSendText, onSendFile, onSendVoice, onSendLocation }: ComposerProps) {
  const { t } = useT();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  // Faqat client'da ma'lum bo'ladigan imkoniyatlar (SSR: null/false → gidratsiya mos)
  const voiceMime = useSyncExternalStore(noopSubscribe, pickRecorderMime, () => null);
  const isTouch = useSyncExternalStore(noopSubscribe, getIsTouch, () => false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_PX ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    resize();
  }, [text, resize]);

  const submitText = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      const ok = await onSendText(value);
      if (ok) {
        setText("");
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isTouch && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submitText();
    }
  };

  const onPickFile = (kind: "image" | "document") => async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      await onSendFile(file, kind);
    } finally {
      setBusy(false);
    }
  };

  const sendLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error(t("chat.composer.location_unsupported"));
      setLocationOpen(false);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setLocationOpen(false);
        void onSendLocation(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setLocating(false);
        setLocationOpen(false);
        toast.error(t("chat.composer.location_denied"));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  const finishVoice = async (blob: Blob, mime: string, seconds: number) => {
    setRecording(false);
    setBusy(true);
    try {
      await onSendVoice(blob, mime, seconds);
    } finally {
      setBusy(false);
    }
  };

  if (disabled) {
    return (
      <div className="border-t border-border bg-card px-4 py-3 pb-safe">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Ban className="size-4 shrink-0" /> {disabledNotice}
          </p>
          {disabledAction ? (
            <Button variant="outline" size="sm" onClick={disabledAction.onClick} loading={disabledAction.loading}>
              {disabledAction.label}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const hasText = text.trim().length > 0;

  return (
    <div className="border-t border-border bg-card/95 px-2 pt-2 pb-2 backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:px-3">
      <div className="mx-auto w-full max-w-3xl pb-safe">
        {recording && voiceMime ? (
          <VoiceRecorder mimeType={voiceMime} onCancel={() => setRecording(false)} onFinish={finishVoice} />
        ) : (
          <div className="flex items-end gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={busy}
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50"
                aria-label={t("chat.composer.attach")}
              >
                {busy ? <Spinner className="size-5" /> : <Paperclip className="size-5" />}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-52">
                <DropdownMenuItem onSelect={() => imageInputRef.current?.click()}>
                  <ImageIcon /> {t("chat.composer.image")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => docInputRef.current?.click()}>
                  <FileText /> {t("chat.composer.file")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setLocationOpen(true)}>
                  <MapPin /> {t("chat.composer.location")}
                </DropdownMenuItem>
                {voiceMime ? (
                  <DropdownMenuItem onSelect={() => setRecording(true)}>
                    <Mic /> {t("chat.composer.voice")}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
            <input ref={imageInputRef} type="file" accept={IMAGE_MIMES.join(",")} className="hidden" onChange={onPickFile("image")} />
            <input ref={docInputRef} type="file" accept={[".pdf", ".doc", ".docx", ...DOCUMENT_MIMES].join(",")} className="hidden" onChange={onPickFile("document")} />

            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={4000}
              placeholder={t("chat.composer.placeholder")}
              aria-label={t("chat.composer.placeholder")}
              enterKeyHint={isTouch ? "enter" : "send"}
              className={cn(
                "min-h-11 flex-1 resize-none rounded-2xl border border-transparent bg-secondary px-4 py-2.5 text-[15px] leading-snug text-foreground placeholder:text-muted-foreground",
                "focus-visible:border-primary focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-primary/20",
              )}
            />

            {hasText || !voiceMime ? (
              <button
                type="button"
                onClick={() => void submitText()}
                disabled={!hasText || busy}
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:opacity-50"
                aria-label={t("chat.composer.send")}
              >
                <Send className="size-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setRecording(true)}
                disabled={busy}
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
                aria-label={t("chat.composer.record")}
              >
                <Mic className="size-5" />
              </button>
            )}
          </div>
        )}
        {!isTouch && !recording ? <p className="mt-1 hidden px-1 text-[11px] text-muted-foreground md:block">{t("chat.composer.hint_enter")}</p> : null}
      </div>

      <ConfirmDialog
        open={locationOpen}
        onOpenChange={(o) => {
          if (!locating) setLocationOpen(o);
        }}
        title={t("chat.composer.location_confirm_title")}
        description={t("chat.composer.location_confirm_desc")}
        confirmLabel={t("common.actions.send")}
        cancelLabel={t("common.actions.cancel")}
        onConfirm={sendLocation}
        loading={locating}
      />
    </div>
  );
}
