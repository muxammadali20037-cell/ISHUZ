"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/utils";
import type { ActionResult } from "@/features/auth/actions";
import { userBlockSchema } from "../schema";
import { requirePerm } from "./guard";

/** Foydalanuvchini bloklash / blokdan chiqarish → rpc admin_set_user_block (audit yozadi) */
export async function setUserBlock(input: unknown): Promise<ActionResult> {
  const parsed = userBlockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("users.block");
  if (!guard.ok) return guard;
  if (parsed.data.profileId === guard.ctx.session.userId) return { ok: false, error: "self_block" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_user_block", {
    p_profile_id: parsed.data.profileId,
    p_block: parsed.data.block,
    p_reason: parsed.data.reason || undefined,
  });
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath("/admin/users");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/workers");
  revalidatePath("/admin/employers");
  return { ok: true };
}
