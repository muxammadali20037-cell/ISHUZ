"use client";

import { Ban, CircleAlert, Clock, EllipsisVertical, Trash } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { tokenizeLinks } from "../linkify";
import type { ChatMessage } from "../types";
import { DocumentAttachment, ImageAttachment, LocationAttachment, VoiceAttachment } from "./attachment";

function LinkifiedText({ text }: { text: string }) {
  return (
    <>
      {tokenizeLinks(text).map((tok, i) =>
        tok.type === "link" ? (
          <a key={i} href={tok.href} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2 break-all">
            {tok.value}
          </a>
        ) : (
          <span key={i}>{tok.value}</span>
        ),
      )}
    </>
  );
}

export function MessageBubble({ message, mine, onDelete }: { message: ChatMessage; mine: boolean; onDelete?: (message: ChatMessage) => void }) {
  const { t } = useT();
  const time = formatTime(message.created_at);

  if (message.type === "system") {
    return (
      <div className="flex justify-center py-1">
        <span className="max-w-[85%] rounded-full bg-secondary px-3 py-1 text-center text-xs text-muted-foreground">{message.body ?? t("chat.room.system")}</span>
      </div>
    );
  }

  const deleted = !!message.deleted_at;
  const sending = message.status === "sending";
  const failed = message.status === "failed";
  const canDelete = mine && !deleted && !sending && !failed && message.id > 0 && !!onDelete;
  const bubbleIsCard = message.type === "image" && !deleted;

  return (
    <div className={cn("group flex items-end gap-1.5", mine ? "justify-end" : "justify-start")}>
      {canDelete ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="mb-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-60 transition-opacity hover:bg-secondary md:opacity-0 md:group-hover:opacity-100 md:data-[state=open]:opacity-100"
            aria-label={t("chat.room.menu")}
          >
            <EllipsisVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem destructive onSelect={() => onDelete?.(message)}>
              <Trash /> {t("chat.room.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <div
        className={cn(
          "relative max-w-[82%] rounded-2xl text-[15px] leading-snug shadow-sm md:max-w-[70%]",
          bubbleIsCard ? "p-1" : "px-3.5 py-2",
          mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border border-border/70 bg-card text-card-foreground",
          (sending || failed) && "opacity-80",
        )}
      >
        {deleted ? (
          <span className={cn("flex items-center gap-1.5 text-sm italic", mine ? "text-white/85" : "text-muted-foreground")}>
            <Ban className="size-3.5" /> {t("chat.room.deleted")}
          </span>
        ) : message.type === "text" ? (
          <p className="whitespace-pre-wrap break-words">
            <LinkifiedText text={message.body ?? ""} />
          </p>
        ) : message.type === "image" ? (
          <ImageAttachment message={message} mine={mine} />
        ) : message.type === "document" ? (
          <DocumentAttachment message={message} mine={mine} />
        ) : message.type === "voice" ? (
          <VoiceAttachment message={message} mine={mine} />
        ) : (
          <LocationAttachment message={message} mine={mine} />
        )}
        <span
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-[11px] leading-none tabular",
            mine ? "text-white/75" : "text-muted-foreground",
            bubbleIsCard && "px-2 pb-1",
          )}
        >
          {failed ? (
            <>
              <CircleAlert className="size-3" /> {t("chat.room.failed")}
            </>
          ) : sending ? (
            <>
              <Clock className="size-3" /> {t("chat.room.sending")}
            </>
          ) : (
            time
          )}
        </span>
      </div>
    </div>
  );
}
