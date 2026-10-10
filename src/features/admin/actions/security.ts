"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/utils";
import type { ActionResult } from "@/features/auth/actions";
import { uuid } from "../schema";
import { requirePerm } from "./guard";

/*
 * Xavfsizlik paneli: cheklovni olib tashlash, rejim (kuzatuv/majburiy), foydalanuvchini barcha qurilmalardan chiqarish.
 * Har biri SQL tomonda ham ruxsat tekshiradi va auditga yozadi.
 */

export async function liftRestriction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.number().int().positive() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("security.manage");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_lift_restriction", { p_id: parsed.data.id });
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath("/admin/security");
  return { ok: true };
}

export async function setSecurityEnforce(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ enforce: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("security.manage");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_security_enforce", { p_enforce: parsed.data.enforce });
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath("/admin/security");
  return { ok: true };
}

export async function revokeUserSessions(input: unknown): Promise<ActionResult<{ sessions: number }>> {
  const parsed = z.object({ profileId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("users.block");
  if (!guard.ok) return guard;
  if (parsed.data.profileId === guard.ctx.session.userId) return { ok: false, error: "self_block" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_revoke_user_sessions", { p_profile_id: parsed.data.profileId });
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath("/admin/users");
  return { ok: true, data: { sessions: data ?? 0 } };
}
