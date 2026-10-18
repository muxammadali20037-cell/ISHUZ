import type { AppMode } from "@/features/mode/mode";
import { isAdminPath } from "@/lib/admin-host";

/**
 * "Telefon raqam orqali kirish" manzili: rol hali tanlanmagan bo'lsa — avval rol (7-ekran), keyin raqam (8-ekran).
 * Admin panelga kirish (`next` = /admin…) — rol so'ralmaydi: u ish izlovchi/ish beruvchi tanlovi emas, alohida admin
 * domenida esa /start sahifalari umuman yo'q. `next` — kirgandan keyingi joy (oldindan tekshirilgan ichki yo'l).
 */
export function phoneLoginHref({ next, mode, phone }: { next: string; mode: AppMode | null; phone?: string | null }): string {
  const q = new URLSearchParams({ next });
  if (phone) q.set("phone", phone);
  const phonePage = `/auth/telefon?${q.toString()}`;
  return mode || isAdminPath(next.split("?")[0] ?? "") ? phonePage : `/start/rol?next=${encodeURIComponent(phonePage)}`;
}
