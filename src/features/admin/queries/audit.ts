import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";
import { PAGE_SIZE, isUuid, pageRange, parsePage, param, toPaged, type Paged, type SearchParams } from "./shared";

/** RPC'lar yozadigan action prefikslari (filtr uchun) */
export const AUDIT_ACTION_GROUPS = ["user.", "vacancy.", "verification.", "report.", "review.", "notifications.", "category.", "subcategory.", "skill.", "region.", "district.", "settings.", "admin."] as const;

export interface AuditFilters {
  action: string;
  actor: string;
  from: string;
  to: string;
  page: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseAuditFilters(sp: SearchParams): AuditFilters {
  const actor = param(sp, "actor");
  const from = param(sp, "from");
  const to = param(sp, "to");
  return {
    action: param(sp, "action").slice(0, 60),
    actor: isUuid(actor) ? actor : "",
    from: DATE_RE.test(from) ? from : "",
    to: DATE_RE.test(to) ? to : "",
    page: parsePage(sp),
  };
}

export type AuditRow = Omit<Tables<"audit_logs">, "ip"> & { actor: { id: string; first_name: string; last_name: string } | null };

/** audit_logs (RLS: audit.view) */
export async function listAuditLogs(f: AuditFilters): Promise<Paged<AuditRow> & { error: string | null }> {
  const supabase = await createClient();
  const [from, to] = pageRange(f.page);
  let q = supabase
    .from("audit_logs")
    .select("id, actor_id, action, target_type, target_id, before_data, after_data, user_agent, created_at, actor:profiles!audit_logs_actor_id_fkey(id, first_name, last_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (f.action) q = q.ilike("action", `${f.action.replace(/[%_,()\\]/g, " ")}%`);
  if (f.actor) q = q.eq("actor_id", f.actor);
  if (f.from) q = q.gte("created_at", `${f.from}T00:00:00+05:00`);
  if (f.to) q = q.lte("created_at", `${f.to}T23:59:59+05:00`);
  const { data, count, error } = await q;
  return { ...toPaged<AuditRow>(data ?? [], count, f.page, PAGE_SIZE), error: error?.message ?? null };
}

export interface BroadcastRow {
  id: number;
  created_at: string;
  actor: { first_name: string; last_name: string } | null;
  title: string;
  role: string | null;
  count: number;
}

/**
 * So'nggi tarqatmalar. notifications jadvali RLS bilan faqat egasiga ochiq, shuning uchun
 * manba — audit_logs (admin_broadcast RPC 'notifications.broadcast' yozuvini qoldiradi).
 */
export async function listBroadcasts(limit = 30): Promise<{ rows: BroadcastRow[]; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, created_at, after_data, actor:profiles!audit_logs_actor_id_fkey(first_name, last_name)")
    .eq("action", "notifications.broadcast")
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows: BroadcastRow[] = (data ?? []).map((r) => {
    const after = r.after_data && typeof r.after_data === "object" && !Array.isArray(r.after_data) ? r.after_data : {};
    return {
      id: r.id,
      created_at: r.created_at,
      actor: r.actor,
      title: typeof after.title === "string" ? after.title : "",
      role: typeof after.role === "string" ? after.role : null,
      count: typeof after.count === "number" ? after.count : Number(after.count ?? 0) || 0,
    };
  });
  return { rows, error: error?.message ?? null };
}
