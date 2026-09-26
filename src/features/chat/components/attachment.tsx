"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, MapPin, ExternalLink } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getAttachmentUrl } from "../actions";
import type { ChatMessage } from "../types";
import { formatBytes, formatDuration, mapUrl } from "../utils";

/** Yopiq bucket fayli uchun imzolangan URL: serverdan kelgan bo'lsa shu, bo'lmasa action orqali */
function useAttachmentUrl(path: string | null, initial: string | null) {
  const query = useQuery({
    queryKey: ["chat-attachment", path],
    queryFn: async () => {
      const res = await getAttachmentUrl({ path });
      if (!res.ok) throw new Error(res.error);
      if (!res.data) throw new Error("not_found");
      return res.data.url;
    },
    enabled: !!path && !initial,
    initialData: initial ?? undefined,
    staleTime: 50 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
  return { url: query.data ?? null, loading: query.isPending && !!path && !initial, failed: query.isError };
}

export function ImageAttachment({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const { t } = useT();
  const { url, loading, failed } = useAttachmentUrl(message.attachment_path, message.signed_url);
  const [open, setOpen] = useState(false);
  const name = message.attachment_meta?.name ?? t("chat.room.image");
  if (loading || (!url && !failed)) return <Skeleton className="h-48 w-56 rounded-xl" />;
  if (!url) return <Unavailable mine={mine} />;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block overflow-hidden rounded-xl focus-visible:ring-2 focus-visible:ring-ring" aria-label={name}>
        {/* eslint-disable-next-line @next/next/no-img-element -- imzolangan vaqtinchalik URL, next/image domenlari sozlanmagan */}
        <img src={url} alt={name} loading="lazy" className="max-h-72 w-auto max-w-[min(70vw,20rem)] object-cover" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={name} className="max-w-3xl bg-black/95 p-2 text-white">
          {/* eslint-disable-next-line @next/next/no-img-element -- imzolangan vaqtinchalik URL */}
          <img src={url} alt={name} className="mx-auto max-h-[80dvh] w-auto max-w-full rounded-lg object-contain" />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DocumentAttachment({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const { t } = useT();
  const { url, loading, failed } = useAttachmentUrl(message.attachment_path, message.signed_url);
  const meta = message.attachment_meta;
  const name = meta?.name ?? t("chat.room.document");
  const size = formatBytes(meta?.size);
  const inner = (
    <>
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", mine ? "bg-white/15" : "bg-primary-soft text-primary")}>
        <FileText className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{name}</span>
        <span className={cn("block text-xs", mine ? "text-white/75" : "text-muted-foreground")}>
          {size ? `${size} · ` : ""}
          {t("chat.room.download")}
        </span>
      </span>
      <Download className="size-4 shrink-0 opacity-70" />
    </>
  );
  if (loading) return <Skeleton className="h-14 w-56 rounded-xl" />;
  if (!url || failed) return <Unavailable mine={mine} />;
  return (
    <a href={url} download={name} target="_blank" rel="noopener noreferrer" className="flex w-60 max-w-full items-center gap-3 rounded-xl py-1 pr-1">
      {inner}
    </a>
  );
}

export function VoiceAttachment({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const { t } = useT();
  const { url, loading, failed } = useAttachmentUrl(message.attachment_path, message.signed_url);
  const duration = message.attachment_meta?.duration;
  if (loading) return <Skeleton className="h-12 w-60 rounded-xl" />;
  if (!url || failed) return <Unavailable mine={mine} />;
  return (
    <div className="w-64 max-w-full">
      <audio controls preload="metadata" src={url} className="w-full" aria-label={t("chat.room.voice")} />
      {duration ? <span className={cn("mt-0.5 block text-[11px]", mine ? "text-white/75" : "text-muted-foreground")}>{formatDuration(duration)}</span> : null}
    </div>
  );
}

export function LocationAttachment({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const { t } = useT();
  if (message.lat === null || message.lng === null) return <Unavailable mine={mine} />;
  return (
    <a
      href={mapUrl(message.lat, message.lng)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("flex w-60 max-w-full items-center gap-3 rounded-xl border p-2.5", mine ? "border-white/20 bg-white/10" : "border-border bg-secondary/60")}
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", mine ? "bg-white/15" : "bg-primary-soft text-primary")}>
        <MapPin className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{t("chat.room.location")}</span>
        <span className={cn("block truncate text-xs tabular", mine ? "text-white/75" : "text-muted-foreground")}>
          {message.lat.toFixed(5)}, {message.lng.toFixed(5)}
        </span>
        <span className={cn("mt-0.5 flex items-center gap-1 text-xs font-medium", mine ? "text-white" : "text-primary")}>
          {t("chat.room.open_map")} <ExternalLink className="size-3" />
        </span>
      </span>
    </a>
  );
}

function Unavailable({ mine }: { mine: boolean }) {
  const { t } = useT();
  return <span className={cn("text-sm italic", mine ? "text-white/80" : "text-muted-foreground")}>{t("chat.room.attachment_unavailable")}</span>;
}
