"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, MessageCircle } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  deleteMessage,
  loadOlderMessages,
  markConversationRead,
  sendAttachmentMessage,
  sendLocationMessage,
  sendTextMessage,
  setConversationBlock,
  setConversationMuted,
} from "../actions";
import { chatErrorText } from "../errors";
import { MAX_FILE_MB } from "../schema";
import type { ChatMessage, ConversationView, MessageRow, MessagesPage, UploadKind } from "../types";
import { uploadChatFile } from "../upload";
import { groupByDay, relativeDay, rowToMessage } from "../utils";
import { ChatHeader } from "./chat-header";
import { Composer } from "./composer";
import { MessageBubble } from "./message-bubble";

let tempCounter = 0;
function tempId(): number {
  tempCounter += 1;
  return -(Date.now() * 10 + (tempCounter % 10));
}

function makeTemp(conversationId: string, myId: string, partial: Partial<ChatMessage>): ChatMessage {
  return {
    id: tempId(),
    conversation_id: conversationId,
    sender_id: myId,
    type: "text",
    body: null,
    attachment_path: null,
    attachment_meta: null,
    lat: null,
    lng: null,
    created_at: new Date().toISOString(),
    deleted_at: null,
    signed_url: null,
    client_id: `c_${Date.now()}_${tempCounter}`,
    status: "sending",
    ...partial,
  };
}

/** Realtime/serverdan kelgan xabarni ro'yxatga qo'shadi: id bo'yicha dedupe, o'zimizniki bo'lsa vaqtinchalik bilan almashtiradi */
function mergeIncoming(prev: ChatMessage[], incoming: ChatMessage, myId: string, clientId?: string): ChatMessage[] {
  const existingIdx = prev.findIndex((m) => m.id === incoming.id);
  if (existingIdx >= 0) {
    const next = prev.filter((m) => !(clientId && m.client_id === clientId));
    const idx = next.findIndex((m) => m.id === incoming.id);
    const current = next[idx];
    if (idx >= 0 && current) next[idx] = { ...incoming, signed_url: incoming.signed_url ?? current.signed_url };
    return next;
  }
  let tempIdx = clientId ? prev.findIndex((m) => m.client_id === clientId) : -1;
  if (tempIdx < 0 && incoming.sender_id === myId) {
    tempIdx = prev.findIndex(
      (m) => m.id < 0 && m.status === "sending" && m.type === incoming.type && (incoming.type !== "text" || (m.body ?? "").trim() === (incoming.body ?? "").trim()),
    );
  }
  if (tempIdx >= 0) {
    const temp = prev[tempIdx];
    const next = prev.slice();
    next[tempIdx] = { ...incoming, signed_url: incoming.signed_url ?? temp?.signed_url ?? null };
    return next;
  }
  return [...prev, incoming];
}

export function ChatRoom({ view, initial, myId }: { view: ConversationView; initial: MessagesPage; myId: string }) {
  const { t, locale } = useT();
  const router = useRouter();
  const conversationId = view.id;

  const [messages, setMessages] = useState<ChatMessage[]>(initial.messages);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(view.me.is_blocked);
  const [blockedByThem, setBlockedByThem] = useState(view.other.is_blocked);
  const [muted, setMuted] = useState(view.me.is_muted);
  const [menuBusy, setMenuBusy] = useState(false);
  const [blockConfirm, setBlockConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [firstUnreadId] = useState<number | null>(() => {
    const since = view.me.last_read_at ? new Date(view.me.last_read_at).getTime() : 0;
    const first = initial.messages.find((m) => m.sender_id !== myId && new Date(m.created_at).getTime() > since);
    return first?.id ?? null;
  });

  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);

  /** Faqat DOM: pastga skroll (holatga tegmaydi) */
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior });
  }, []);

  /** Yangi xabar qo'shilgandan keyin: pastda bo'lsak yoki o'zimizniki bo'lsa — pastga; aks holda "Yangi xabarlar" tugmasi */
  const afterAppend = useCallback(
    (mine: boolean) => {
      if (mine || nearBottomRef.current) {
        requestAnimationFrame(() => scrollToBottom("smooth"));
      } else {
        setShowJump(true);
      }
    },
    [scrollToBottom],
  );

  const markRead = useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    void markConversationRead({ conversationId });
  }, [conversationId]);

  // Dastlabki ochilish: pastga, o'qildi
  useLayoutEffect(() => {
    scrollToBottom("auto");
  }, [scrollToBottom]);

  useEffect(() => {
    markRead();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        markRead();
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [markRead, router]);

  // Skroll holati
  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    nearBottomRef.current = gap < 120;
    if (nearBottomRef.current) setShowJump(false);
  };

  // Realtime: INSERT / UPDATE (o'chirish) faqat shu suhbat uchun
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on<MessageRow>("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const row = payload.new;
        setMessages((prev) => mergeIncoming(prev, rowToMessage(row), myId));
        afterAppend(row.sender_id === myId);
        if (row.sender_id !== myId) markRead();
      })
      .on<MessageRow>("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const row = payload.new;
        setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...rowToMessage(row), signed_url: row.deleted_at ? null : m.signed_url } : m)));
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, myId, markRead, afterAppend]);

  const failTemp = (clientId: string, code: string) => {
    setMessages((prev) => prev.map((m) => (m.client_id === clientId ? { ...m, status: "failed" } : m)));
    if (code === "blocked_by_member") setBlockedByThem(true);
    toast.error(chatErrorText(t, code));
  };

  const handleSendText = async (text: string): Promise<boolean> => {
    const temp = makeTemp(conversationId, myId, { type: "text", body: text });
    setMessages((prev) => [...prev, temp]);
    afterAppend(true);
    const res = await sendTextMessage({ conversationId, body: text });
    if (!res.ok || !res.data) {
      failTemp(temp.client_id ?? "", res.ok ? "generic" : res.error);
      return false;
    }
    const sent = res.data;
    setMessages((prev) => mergeIncoming(prev, sent, myId, temp.client_id));
    return true;
  };

  const sendUploaded = async (file: File | Blob, kind: UploadKind, extra: { name?: string; duration?: number }, preview: Partial<ChatMessage>) => {
    const temp = makeTemp(conversationId, myId, { type: kind, ...preview });
    setMessages((prev) => [...prev, temp]);
    afterAppend(true);
    const uploaded = await uploadChatFile(conversationId, file, kind, extra);
    if (!uploaded.ok) {
      setMessages((prev) => prev.filter((m) => m.client_id !== temp.client_id));
      toast.error(uploaded.error === "too_large" ? t("chat.composer.too_large", { max: MAX_FILE_MB }) : uploaded.error === "bad_type" ? t("chat.composer.bad_type") : t("chat.composer.upload_failed"));
      return;
    }
    const res = await sendAttachmentMessage({ conversationId, type: kind, path: uploaded.path, meta: uploaded.meta });
    if (!res.ok || !res.data) {
      failTemp(temp.client_id ?? "", res.ok ? "generic" : res.error);
      return;
    }
    const sent = res.data;
    setMessages((prev) => mergeIncoming(prev, sent, myId, temp.client_id));
  };

  const handleSendFile = async (file: File, kind: "image" | "document") => {
    const localUrl = kind === "image" ? URL.createObjectURL(file) : null;
    await sendUploaded(file, kind, { name: file.name }, {
      attachment_path: `${conversationId}/pending`,
      attachment_meta: { name: file.name, size: file.size, mime: file.type },
      signed_url: localUrl,
    });
  };

  const handleSendVoice = async (blob: Blob, mime: string, seconds: number) => {
    await sendUploaded(blob, "voice", { name: `voice.${mime.includes("ogg") ? "ogg" : "webm"}`, duration: seconds }, {
      attachment_path: `${conversationId}/pending`,
      attachment_meta: { size: blob.size, mime, duration: Math.round(seconds) },
      signed_url: URL.createObjectURL(blob),
    });
  };

  const handleSendLocation = async (lat: number, lng: number) => {
    const temp = makeTemp(conversationId, myId, { type: "location", lat, lng });
    setMessages((prev) => [...prev, temp]);
    afterAppend(true);
    const res = await sendLocationMessage({ conversationId, lat, lng });
    if (!res.ok || !res.data) {
      failTemp(temp.client_id ?? "", res.ok ? "generic" : res.error);
      return;
    }
    const sent = res.data;
    setMessages((prev) => mergeIncoming(prev, sent, myId, temp.client_id));
  };

  const handleLoadOlder = async () => {
    const oldest = messages.find((m) => m.id > 0);
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    const el = listRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;
    const res = await loadOlderMessages({ conversationId, before: oldest.id });
    setLoadingOlder(false);
    if (!res.ok || !res.data) {
      toast.error(chatErrorText(t, res.ok ? "generic" : res.error));
      return;
    }
    const older = res.data.messages;
    setHasMore(res.data.hasMore);
    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id));
      return [...older.filter((m) => !known.has(m.id)), ...prev];
    });
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight + prevTop;
    });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await deleteMessage({ conversationId, messageId: deleteTarget.id });
    setDeleting(false);
    if (!res.ok) {
      toast.error(chatErrorText(t, res.error));
      return;
    }
    const targetId = deleteTarget.id;
    setMessages((prev) => prev.map((m) => (m.id === targetId ? { ...m, deleted_at: new Date().toISOString(), body: null, attachment_path: null, signed_url: null, lat: null, lng: null } : m)));
    setDeleteTarget(null);
    toast.success(t("chat.room.deleted_toast"));
  };

  const applyBlock = async (blocked: boolean) => {
    setMenuBusy(true);
    const res = await setConversationBlock({ conversationId, blocked });
    setMenuBusy(false);
    if (!res.ok) {
      toast.error(chatErrorText(t, res.error));
      return;
    }
    setBlockedByMe(blocked);
    setBlockConfirm(false);
    toast.success(blocked ? t("chat.room.blocked_toast") : t("chat.room.unblocked_toast"));
  };

  const toggleMute = async () => {
    setMenuBusy(true);
    const next = !muted;
    const res = await setConversationMuted({ conversationId, muted: next });
    setMenuBusy(false);
    if (!res.ok) {
      toast.error(chatErrorText(t, res.error));
      return;
    }
    setMuted(next);
    toast.success(next ? t("chat.room.muted_toast") : t("chat.room.unmuted_toast"));
  };

  const groups = useMemo(() => groupByDay(messages), [messages]);
  const now = new Date();

  const dayLabel = (key: string, iso: string) => {
    const rel = relativeDay(key, now);
    if (rel === "today") return t("chat.room.today");
    if (rel === "yesterday") return t("chat.room.yesterday");
    const sameYear = key.slice(0, 4) === String(now.getFullYear());
    return formatDate(iso, locale, sameYear ? "d MMMM" : "d MMMM yyyy");
  };

  return (
    <div className="flex flex-col bg-background" style={{ height: "calc(100dvh - 3.5rem - env(safe-area-inset-top, 0px))" }}>
      <ChatHeader
        view={view}
        blockedByMe={blockedByMe}
        muted={muted}
        busy={menuBusy}
        onToggleMute={() => void toggleMute()}
        onToggleBlock={() => (blockedByMe ? void applyBlock(false) : setBlockConfirm(true))}
      />

      <div ref={listRef} onScroll={onScroll} className="relative flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-1.5">
          {hasMore ? (
            <div className="mb-2 flex justify-center">
              <Button variant="outline" size="sm" onClick={() => void handleLoadOlder()} loading={loadingOlder}>
                {t("chat.room.load_older")}
              </Button>
            </div>
          ) : null}

          {!messages.length ? (
            <EmptyState icon={MessageCircle} title={t("chat.room.empty_title")} description={t("chat.room.empty_desc")} className="my-10 border-0" />
          ) : null}

          {groups.map((g) => (
            <Fragment key={g.key}>
              <div className="sticky top-0 z-10 my-2 flex justify-center">
                <span className="rounded-full border border-border/70 bg-card/90 px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm backdrop-blur">
                  {dayLabel(g.key, g.items[0]?.created_at ?? new Date().toISOString())}
                </span>
              </div>
              {g.items.map((m) => (
                <Fragment key={m.client_id ?? m.id}>
                  {firstUnreadId !== null && m.id === firstUnreadId ? (
                    <div className="my-2 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-primary">
                      <span className="h-px flex-1 bg-primary/30" />
                      {t("chat.room.new_messages")}
                      <span className="h-px flex-1 bg-primary/30" />
                    </div>
                  ) : null}
                  <MessageBubble message={m} mine={m.sender_id === myId} onDelete={setDeleteTarget} />
                </Fragment>
              ))}
            </Fragment>
          ))}
          <div ref={bottomRef} className="h-px" />
        </div>
      </div>

      {showJump ? (
        <div className="pointer-events-none relative">
          <button
            type="button"
            onClick={() => {
              setShowJump(false);
              scrollToBottom("smooth");
            }}
            className={cn(
              "pointer-events-auto absolute bottom-3 left-1/2 flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg",
              "animate-in fade-in-0 slide-in-from-bottom-2",
            )}
          >
            <ArrowDown className="size-4" /> {t("chat.room.new_messages")}
          </button>
        </div>
      ) : null}

      <Composer
        disabled={blockedByMe || blockedByThem}
        disabledNotice={blockedByMe ? t("chat.room.blocked_by_me") : t("chat.room.blocked_by_them")}
        disabledAction={blockedByMe ? { label: t("chat.room.unblock"), onClick: () => void applyBlock(false), loading: menuBusy } : undefined}
        onSendText={handleSendText}
        onSendFile={handleSendFile}
        onSendVoice={handleSendVoice}
        onSendLocation={handleSendLocation}
      />

      <ConfirmDialog
        open={blockConfirm}
        onOpenChange={setBlockConfirm}
        title={t("chat.room.block_confirm_title")}
        description={t("chat.room.block_confirm_desc")}
        confirmLabel={t("chat.room.block")}
        cancelLabel={t("common.actions.cancel")}
        onConfirm={() => applyBlock(true)}
        destructive
        loading={menuBusy}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o && !deleting) setDeleteTarget(null);
        }}
        title={t("chat.room.delete_confirm_title")}
        description={t("chat.room.delete_confirm_desc")}
        confirmLabel={t("chat.room.delete")}
        cancelLabel={t("common.actions.cancel")}
        onConfirm={confirmDelete}
        destructive
        loading={deleting}
      />
    </div>
  );
}
