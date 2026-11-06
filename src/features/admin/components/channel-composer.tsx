"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { ExternalLink, Images, Send, Type, Video } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Checkbox, RadioGroup, RadioItem } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { CAPTION_LIMIT, TEXT_LIMIT, telegramLength, type ChannelMediaId } from "@/features/telegram-channel/media";
import { sendChannelPost } from "../actions/telegram-channel";
import { errorText } from "./note-dialog";

export interface ComposerMedia {
  id: ChannelMediaId;
  kind: "video" | "album";
  poster: string;
  count: number;
  /** soniyalarda (video uchun) */
  duration?: number;
  caption: string;
}

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

/**
 * Kanal posti: tayyor material (video / rasm-albom) yoki faqat matn → tasdiqlash → bot kanalga joylaydi.
 * Material tanlanganda matn uning tayyor izohi bilan to'ldiriladi (admin o'zgartirmagan bo'lsa).
 */
export function ChannelComposer({ media, ready, canPin }: { media: ComposerMedia[]; ready: boolean; canPin: boolean }) {
  const { t } = useT();
  const [mediaId, setMediaId] = useState<ChannelMediaId | null>(media[0]?.id ?? null);
  const [text, setText] = useState(media[0]?.caption ?? "");
  const [pin, setPin] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [sent, setSent] = useState<{ link: string | null; pinned: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = media.find((m) => m.id === mediaId) ?? null;
  const limit = selected ? CAPTION_LIMIT : TEXT_LIMIT;
  const length = telegramLength(text.trim());
  const tooLong = length > limit;
  const empty = !selected && length === 0;
  const invalid = tooLong || empty;

  const pick = (value: string) => {
    const next = media.find((m) => m.id === value) ?? null;
    // admin matnni o'zgartirmagan bo'lsa (yoki bo'sh) — yangi materialning tayyor izohini qo'yamiz
    const untouched = !text.trim() || media.some((m) => m.caption === text);
    setMediaId(next?.id ?? null);
    if (untouched) setText(next?.caption ?? "");
    setSent(null);
  };

  const send = () => {
    startTransition(async () => {
      const res = await sendChannelPost({ text, mediaId, pin: pin && canPin });
      setConfirm(false);
      if (!res.ok) {
        toast.error(errorText(t, res.error));
        return;
      }
      setSent(res.data ?? { link: null, pinned: false });
      toast.success(t("admin.telegram.sent"));
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,560px)_minmax(0,380px)]">
      <form
        className="space-y-5 rounded-2xl border border-border/70 bg-card p-5 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (!invalid && ready) setConfirm(true);
        }}
      >
        <Field label={t("admin.telegram.field_media")}>
          <RadioGroup value={mediaId ?? "none"} onValueChange={pick} className="grid gap-2 sm:grid-cols-2">
            {media.map((m) => (
              <RadioItem
                key={m.id}
                value={m.id}
                label={
                  <span className="flex items-center gap-3">
                    <span className="relative h-16 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                      <Image src={m.poster} alt="" fill sizes="48px" className="object-cover" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium">{t(`admin.telegram.media_${m.id}`)}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        {m.kind === "video" ? <Video className="size-3.5" aria-hidden /> : <Images className="size-3.5" aria-hidden />}
                        {m.kind === "video" ? t("admin.telegram.kind_video") : t("admin.telegram.kind_album", { count: m.count })}
                      </span>
                    </span>
                  </span>
                }
              />
            ))}
            <RadioItem
              value="none"
              label={
                <span className="flex items-center gap-3">
                  <span className="flex h-16 w-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Type className="size-5" aria-hidden />
                  </span>
                  <span className="font-medium">{t("admin.telegram.media_none")}</span>
                </span>
              }
            />
          </RadioGroup>
        </Field>

        <Field
          label={t("admin.telegram.field_text")}
          htmlFor="tg-text"
          required={!selected}
          error={tooLong ? t("admin.telegram.too_long", { limit }) : undefined}
          description={selected ? t("admin.telegram.caption_hint") : undefined}
        >
          <Textarea
            id="tg-text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSent(null);
            }}
            rows={12}
            maxLength={TEXT_LIMIT}
            invalid={tooLong}
            className="font-sans leading-relaxed"
          />
          <p className={cn("mt-1 text-right text-xs tabular-nums", tooLong ? "text-destructive" : "text-muted-foreground")} aria-live="polite">
            {length} / {limit}
          </p>
        </Field>

        <Checkbox
          checked={pin && canPin}
          onCheckedChange={(v) => setPin(v === true)}
          disabled={!canPin}
          label={t("admin.telegram.pin")}
          description={canPin ? t("admin.telegram.pin_desc") : t("admin.telegram.pin_hint")}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{ready ? t("admin.telegram.send_note") : t("admin.telegram.not_ready")}</p>
          <Button type="submit" loading={pending} disabled={!ready || invalid}>
            <Send className="size-4" />
            {t("admin.telegram.send")}
          </Button>
        </div>

        {sent ? (
          <div role="status" className="rounded-xl border border-success/40 bg-success-soft p-3.5 text-sm">
            <p className="font-medium">{sent.pinned ? t("admin.telegram.sent_pinned") : t("admin.telegram.sent")}</p>
            {sent.link ? (
              <a href={sent.link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline">
                {t("admin.telegram.open_post")}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            ) : null}
          </div>
        ) : null}

        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title={t("admin.telegram.confirm_title")}
          description={t("admin.telegram.confirm_desc")}
          confirmLabel={t("admin.telegram.send")}
          cancelLabel={t("common.actions.cancel")}
          onConfirm={send}
          loading={pending}
        />
      </form>

      <section aria-labelledby="tg-preview" className="space-y-2">
        <h2 id="tg-preview" className="text-base font-semibold">
          {t("admin.telegram.preview")}
        </h2>
        <div className="rounded-2xl bg-primary-soft/70 p-4 dark:bg-muted">
          <div className={cn("overflow-hidden rounded-2xl rounded-bl-md bg-card shadow-sm", selected?.kind === "video" ? "max-w-[280px]" : "max-w-[340px]")}>
            {selected ? (
              <div className={cn("relative bg-muted", selected.kind === "video" ? "aspect-[9/16]" : "aspect-[4/5]")}>
                <Image src={selected.poster} alt="" fill sizes="340px" className="object-cover" />
                {selected.kind === "album" && selected.count > 1 ? (
                  <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">1/{selected.count}</span>
                ) : null}
                {selected.kind === "video" && selected.duration ? (
                  <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                    <Video className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
                    {clock(selected.duration)}
                  </span>
                ) : null}
              </div>
            ) : null}
            {text.trim() ? <p className="whitespace-pre-wrap break-words px-3.5 py-2.5 text-sm leading-relaxed">{text.trim()}</p> : null}
            {!selected && !text.trim() ? <p className="px-3.5 py-2.5 text-sm text-muted-foreground">{t("admin.telegram.preview_empty")}</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
