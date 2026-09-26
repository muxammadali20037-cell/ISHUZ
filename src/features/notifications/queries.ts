import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

export const NOTIFICATIONS_PAGE_SIZE = 30;

export type NotificationRow = Tables<"notifications">;

export interface NotificationsPage {
  items: NotificationRow[];
  page: number;
  total: number;
  hasMore: boolean;
  unread: number;
}

/** Mening bildirishnomalarim (RLS: profile_id = auth.uid()), sahifalab */
export async function getNotificationsPage(page: number): Promise<NotificationsPage> {
  const supabase = await createClient();
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const from = (safePage - 1) * NOTIFICATIONS_PAGE_SIZE;
  const [listRes, unreadRes] = await Promise.all([
    supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + NOTIFICATIONS_PAGE_SIZE - 1),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  if (listRes.error) {
    console.error("[notifications] list", listRes.error.message);
    return { items: [], page: safePage, total: 0, hasMore: false, unread: 0 };
  }
  const total = listRes.count ?? 0;
  return {
    items: listRes.data ?? [],
    page: safePage,
    total,
    hasMore: from + NOTIFICATIONS_PAGE_SIZE < total,
    unread: unreadRes.count ?? 0,
  };
}
