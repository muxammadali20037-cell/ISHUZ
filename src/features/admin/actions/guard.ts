import "server-only";

import type { ActionResult } from "@/features/auth/actions";
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
