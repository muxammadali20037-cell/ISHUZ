"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/features/auth/actions";
import { getSession } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Hisobni butunlay o'chirish (foydalanuvchining o'zi). Tasdiq so'zi serverda ham tekshiriladi.
 * 1) prepare_account_deletion: egasiz qoladigan vakansiyalar yopiladi, audit log;
 * 2) service role bilan auth foydalanuvchi o'chiriladi → profil va shaxsiy ma'lumotlar cascade;
 *    to'lov yozuvlari saqlanadi (profile_id bo'shaydi).
 */
export async function deleteMyAccount(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ confirm: z.string() }).safeParse(input);
  if (!parsed.success || !["O'CHIRISH", "OCHIRISH", "УДАЛИТЬ"].includes(parsed.data.confirm.trim().toUpperCase().replace(/[’‘`ʻʼ]/g, "'"))) {
    return { ok: false, error: "confirm_mismatch" };
  }
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("prepare_account_deletion");
  if (error) return { ok: false, error: error.message.includes("admin_cannot_delete") ? "admin_cannot_delete" : "generic" };
  try {
    const admin = createAdminClient();
    const { error: delError } = await admin.auth.admin.deleteUser(session.userId);
    if (delError) throw delError;
  } catch (e) {
    console.error("[account] delete", e instanceof Error ? e.message : e);
    return { ok: false, error: "generic" };
  }
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
