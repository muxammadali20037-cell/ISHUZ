import "server-only";

import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/auth/actions";
import type { Json } from "@/types/database.types";
import { getAdminActor, type AdminContext } from "../context";
import type { Permission } from "../permissions";

/**
 * Action'lar uchun ruxsat tekshiruvi. RPC/RLS baribir tekshiradi — bu erta va aniq xabar uchun.
 */
export async function requirePerm(perm: Permission): Promise<{ ok: true; ctx: AdminContext } | { ok: false; error: string }> {
  const ctx = await getAdminActor();
  if (!ctx) return { ok: false, error: "not_authenticated" };
  if (!ctx.can(perm)) return { ok: false, error: "forbidden" };
  return { ok: true, ctx };
}

export function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

/**
 * To'g'ridan-to'g'ri jadval yozuvlaridan keyin audit: rpc admin_log (security definer, actor = auth.uid()).
 * Asosiy yozuv allaqachon bajarilgan, shuning uchun log xatosi amalni buzmaydi — faqat serverda qayd etiladi.
 */
export async function logAdmin(supabase: SupabaseServerClient, action: string, targetType: string, targetId: string | null, before: Json | null, after: Json | null): Promise<void> {
  const { error } = await supabase.rpc("admin_log", {
    p_action: action,
    p_target_type: targetType,
    p_target_id: targetId ?? undefined,
    p_before: before ?? undefined,
    p_after: after ?? undefined,
  });
  if (error) console.error("[admin] admin_log", action, targetType, targetId, error.message);
}

/** Jadval qatorini JSON snapshot'ga aylantirish (audit before/after uchun) */
export function snapshot(row: Record<string, unknown> | null | undefined): Json | null {
  if (!row) return null;
  return JSON.parse(JSON.stringify(row)) as Json;
}
