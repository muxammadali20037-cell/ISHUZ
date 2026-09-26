"use client";

import { Fragment, useEffect, useMemo, useState, useTransition, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { formatDate, formatTime } from "@/lib/format";
import type { Tables } from "@/types/database.types";
import { cn } from "@/lib/utils";
import { dayKey, groupByDay, relativeDay } from "@/features/chat/utils";
import { markNotificationsRead } from "../actions";
import type { NotificationRow } from "../queries";
import { renderNotification } from "../render";
import { NotificationIcon } from "./notification-icon";

export function NotificationList({
  items: initialItems,
  page,
  hasMore,
  unread: initialUnread,
  myId,
}: {
  items: NotificationRow[];
  page: number;
  hasMore: boolean;
  unread: number;
  myId: string;
}) {
  const { t, locale } = useT();
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [unread, setUnread] = useState(initialUnread);
  const [pending, startTransition] = useTransition();

  // Server qayta render qilganda (router.refresh) props'dan holatni yangilash (render vaqtida — React tavsiyasi)
  const [syncedItems, setSyncedItems] = useState(initialItems);
  if (syncedItems !== initialItems) {
    setSyncedItems(initialItems);
    setItems(initialItems);
    setUnread(initialUnread);
  }

  // Realtime: menga yangi bildirishnoma → boshiga qo'shish + toast
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${myId}`)
      .on<Tables<"notifications">>("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `profile_id=eq.${myId}` }, (payload) => {
        const row = payload.new;
        const rendered = renderNotification(row.type, row.payload, t, locale);
        toast.info(rendered.title, rendered.body || undefined);
        if (page === 1) {
          setItems((prev) => (prev.some((n) => n.id === row.id) ? prev : [row, ...prev]));
        }
        setUnread((n) => n + 1);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [myId, page, t, locale]);

  const groups = useMemo(() => groupByDay(items), [items]);
  const now = new Date();
  const dayLabel = (key: string, iso: string) => {
    const rel = relativeDay(key, now);
    if (rel === "today") return t("notifications.today");
    if (rel === "yesterday") return t("notifications.yesterday");
    const sameYear = key.slice(0, 4) === String(now.getFullYear());
    return formatDate(iso, locale, sameYear ? "d MMMM" : "d MMMM yyyy");
  };

  const openItem = (n: NotificationRow) => async (e: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    e.preventDefault();
    if (!n.read_at) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      setUnread((c) => Math.max(0, c - 1));
      const res = await markNotificationsRead({ ids: [n.id] });
      if (!res.ok) toast.error(t(`common.errors.${res.error}`));
    }
    if (n.link) router.push(n.link);
  };

  const markAll = () => {
    startTransition(async () => {
      const res = await markNotificationsRead({});
      if (!res.ok) {
        toast.error(t(`common.errors.${res.error}`));
        return;
      }
      const ts = new Date().toISOString();
      setItems((prev) => prev.map((x) => (x.read_at ? x : { ...x, read_at: ts })));
      setUnread(0);
      toast.success(t("notifications.all_read_toast"));
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{unread ? t("notifications.unread_count", { count: unread }) : t("notifications.page", { page })}</p>
        <Button variant="ghost" size="sm" onClick={markAll} loading={pending} disabled={!unread}>
          <CheckCheck className="size-4" /> {t("notifications.mark_all_read")}
        </Button>
      </div>

      {!items.length ? (
        <EmptyState icon={Bell} title={t("notifications.empty_title")} description={t("notifications.empty_desc")} />
      ) : (
        groups.map((g) => (
          <section key={g.key}>
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{dayLabel(g.key, g.items[0]?.created_at ?? "")}</h2>
            <ul className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm divide-y divide-border/70">
              {g.items.map((n) => {
                const r = renderNotification(n.type, n.payload, t, locale);
                const isUnread = !n.read_at;
                const content = (
                  <Fragment>
                    <NotificationIcon kind={r.icon} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className={cn("line-clamp-2 text-[15px] leading-snug", isUnread ? "font-bold" : "font-semibold")}>{r.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular">{formatTime(n.created_at)}</span>
                      </span>
                      {r.body ? <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{r.body}</span> : null}
                    </span>
                    <span className={cn("mt-2 size-2 shrink-0 rounded-full", isUnread ? "bg-primary" : "bg-transparent")} aria-label={isUnread ? t("notifications.unread") : undefined} />
                  </Fragment>
                );
                const cls = cn("flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-secondary/60 active:bg-secondary", isUnread && "bg-primary-soft/30");
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link href={n.link} onClick={openItem(n)} className={cls}>
                        {content}
                      </Link>
                    ) : (
                      <button type="button" onClick={openItem(n)} className={cls}>
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {page > 1 || hasMore ? (
        <nav className="flex items-center justify-between gap-2 pt-2" aria-label="Pagination">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={page - 1 === 1 ? "/notifications" : `/notifications?page=${page - 1}`}>{t("notifications.prev")}</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted-foreground">{t("notifications.page", { page })}</span>
          {hasMore ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/notifications?page=${page + 1}`}>{t("notifications.next")}</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}

export { dayKey };
