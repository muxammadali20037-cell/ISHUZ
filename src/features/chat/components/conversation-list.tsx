"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, FileText, Image as ImageIcon, MapPin, MessageCircle, Mic } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { chatErrorText } from "../errors";
import type { ConversationListItem } from "../types";
import { previewKind } from "../utils";

function nameInitials(name: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.charAt(0) ?? "";
  const b = parts[1]?.charAt(0) ?? "";
  return (a + b).toUpperCase() || "?";
}

/** Suhbatlar ro'yxati (client: realtime yangilanish + ?error= toast) */
export function ConversationList({ items, errorCode }: { items: ConversationListItem[]; errorCode?: string }) {
  const { t, locale } = useT();
  const router = useRouter();

  useEffect(() => {
    if (!errorCode) return;
    toast.error(chatErrorText(t, errorCode));
    router.replace("/messages");
  }, [errorCode, router, t]);

  // Yangi xabar (RLS: faqat mening suhbatlarim) → ro'yxatni serverdan qayta olish
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };
    const channel = supabase
      .channel("conversation-list")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations" }, refresh)
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  if (!items.length) {
    return (
      <EmptyState
        icon={MessageCircle}
        title={t("chat.list.empty_title")}
        description={t("chat.list.empty_desc")}
        action={{ label: t("chat.list.empty_cta"), href: "/jobs" }}
      />
    );
  }

  return (
    <ul className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm divide-y divide-border/70">
      {items.map((c) => {
        const unread = Number(c.unread_count ?? 0);
        const kind = previewKind(c.last_message_preview);
        const previewIcon = kind === "image" ? ImageIcon : kind === "document" ? FileText : kind === "location" ? MapPin : kind === "voice" ? Mic : null;
        const previewText =
          kind === "text"
            ? c.last_message_preview
            : kind === "image"
              ? t("chat.room.image")
              : kind === "document"
                ? t("chat.room.document")
                : kind === "location"
                  ? t("chat.room.location")
                  : kind === "voice"
                    ? t("chat.room.voice")
                    : t("chat.list.no_messages");
        return (
          <li key={c.id}>
            <Link href={`/messages/${c.id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-secondary/60 active:bg-secondary">
              <Avatar src={c.other_avatar_url} fallback={nameInitials(c.other_name)} alt={c.other_name ?? ""} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={cn("truncate text-[15px]", unread ? "font-bold" : "font-semibold")}>{c.other_name}</p>
                  {c.last_message_at ? <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(c.last_message_at, locale)}</span> : null}
                </div>
                {c.context_title ? (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Briefcase className="size-3.5 shrink-0" />
                    <span className="truncate">
                      {c.context_title}
                      {c.company_name ? ` · ${c.company_name}` : ""}
                    </span>
                  </p>
                ) : null}
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className={cn("flex min-w-0 items-center gap-1 truncate text-sm", unread ? "font-medium text-foreground" : "text-muted-foreground")}>
                    {previewIcon ? <span className="inline-flex shrink-0 [&_svg]:size-3.5">{previewIcon({})}</span> : null}
                    <span className="truncate">{previewText}</span>
                  </p>
                  {unread ? (
                    <span
                      className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground"
                      aria-label={t("chat.list.unread_aria", { count: unread })}
                    >
                      {unread > 99 ? "99+" : unread}
                    </span>
                  ) : null}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
