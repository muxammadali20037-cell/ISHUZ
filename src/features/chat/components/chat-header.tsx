"use client";

import { useRef } from "react";
import Link from "next/link";
import { Ban, Bell, BellOff, Briefcase, ChevronLeft, EllipsisVertical, Flag, ShieldCheck } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ReportDialog } from "@/features/reports/report-dialog";
import { initials } from "@/lib/format";
import type { ConversationView } from "../types";

export function ChatHeader({
  view,
  blockedByMe,
  muted,
  busy,
  onToggleBlock,
  onToggleMute,
}: {
  view: ConversationView;
  blockedByMe: boolean;
  muted: boolean;
  busy: boolean;
  onToggleBlock: () => void;
  onToggleMute: () => void;
}) {
  const { t } = useT();
  const reportRef = useRef<HTMLDivElement>(null);
  const [first, ...rest] = view.other.name.split(" ");
  const avatar = <Avatar src={view.other.avatar_url} fallback={initials(first, rest.join(" "))} alt={view.other.name} size="md" />;
  const contextLabel = view.context.kind === "application" ? t("chat.room.context_application") : t("chat.room.context_offer");

  return (
    <header className="shrink-0 border-b border-border/70 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-2 py-2 sm:px-4">
        <Link href="/messages" className="flex size-10 shrink-0 items-center justify-center rounded-xl hover:bg-secondary" aria-label={t("chat.room.back")}>
          <ChevronLeft className="size-6" />
        </Link>
        {view.otherHref ? (
          <Link href={view.otherHref} className="shrink-0 rounded-full">
            {avatar}
          </Link>
        ) : (
          avatar
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {view.otherHref ? (
              <Link href={view.otherHref} className="truncate text-[15px] font-bold hover:underline">
                {view.other.name}
              </Link>
            ) : (
              <p className="truncate text-[15px] font-bold">{view.other.name}</p>
            )}
            {muted ? (
              <Badge size="sm" className="shrink-0">
                <BellOff /> {t("chat.room.muted_badge")}
              </Badge>
            ) : null}
            {blockedByMe ? (
              <Badge size="sm" variant="destructive" className="shrink-0">
                <Ban /> {t("chat.room.blocked_badge")}
              </Badge>
            ) : null}
          </div>
          {view.context.title ? (
            view.context.href ? (
              <Link href={view.context.href} className="flex items-center gap-1 truncate text-xs text-muted-foreground hover:text-primary">
                <Briefcase className="size-3.5 shrink-0" />
                <span className="truncate">
                  {contextLabel}: {view.context.title}
                  {view.context.company ? ` · ${view.context.company}` : ""}
                </span>
              </Link>
            ) : (
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                <Briefcase className="size-3.5 shrink-0" />
                <span className="truncate">
                  {contextLabel}: {view.context.title}
                  {view.context.company ? ` · ${view.context.company}` : ""}
                </span>
              </p>
            )
          ) : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={busy}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary disabled:opacity-50"
            aria-label={t("chat.room.menu")}
          >
            <EllipsisVertical className="size-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem onSelect={onToggleMute}>
              {muted ? <Bell /> : <BellOff />} {muted ? t("chat.room.unmute") : t("chat.room.mute")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                // ReportDialog o'z trigger'i bilan keladi; menyu yopilgach dasturiy bosamiz
                window.setTimeout(() => reportRef.current?.querySelector("button")?.click(), 60);
              }}
            >
              <Flag /> {t("common.actions.report")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive={!blockedByMe} onSelect={onToggleBlock}>
              {blockedByMe ? <ShieldCheck /> : <Ban />} {blockedByMe ? t("chat.room.unblock") : t("chat.room.block")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div ref={reportRef} className="hidden">
          <ReportDialog targetType="profile" targetId={view.other.profile_id} iconOnly />
        </div>
      </div>
    </header>
  );
}
