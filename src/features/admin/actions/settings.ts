"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/utils";
import type { ActionResult } from "@/features/auth/actions";
import type { Json } from "@/types/database.types";
import { isPermission } from "../permissions";
import { adminUpsertSchema, settingUpdateSchema, uuid } from "../schema";
import { requirePerm } from "./guard";

/*
 * app_settings va admin_users ga to'g'ridan-to'g'ri yozish (RLS: settings.manage / admins.manage).
 * Audit yozilmaydi (docs/db-requests/admin.md — admin_log RPC so'ralgan).
 */

/** Sozlama qiymatini yangilash (JSON) */
export async function updateSetting(input: unknown): Promise<ActionResult> {
  const parsed = settingUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("settings.manage");
  if (!guard.ok) return guard;
  let value: Json;
  try {
    value = JSON.parse(parsed.data.valueJson) as Json;
  } catch {
    return { ok: false, error: "invalid_json" };
  }
  if (value === null) return { ok: false, error: "invalid_json" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("app_settings").update({ value, is_public: parsed.data.is_public }).eq("key", parsed.data.key).select("key");
  if (error) return { ok: false, error: errorCode(error) };
  if (!data?.length) return { ok: false, error: "forbidden" };
  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Admin qo'shish yoki rolini/ruxsatlarini/holatini o'zgartirish (faqat admins.manage → super_admin) */
export async function upsertAdminUser(input: unknown): Promise<ActionResult> {
  const parsed = adminUpsertSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("admins.manage");
  if (!guard.ok) return guard;
  const { profileId, role, permissions, is_active } = parsed.data;
  if (profileId === guard.ctx.session.userId && (!is_active || role !== "super_admin")) return { ok: false, error: "self_demote" };
  const perms = [...new Set(permissions.filter(isPermission))];
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("id").eq("id", profileId).maybeSingle();
  if (!profile) return { ok: false, error: "profile_not_found" };
  const { error } = await supabase
    .from("admin_users")
    .upsert({ profile_id: profileId, role, permissions: perms, is_active, created_by: guard.ctx.session.userId }, { onConflict: "profile_id" });
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath("/admin/settings");
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/** Adminni faolsizlantirish / qayta faollashtirish */
export async function setAdminActive(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ profileId: uuid, active: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("admins.manage");
  if (!guard.ok) return guard;
  if (parsed.data.profileId === guard.ctx.session.userId && !parsed.data.active) return { ok: false, error: "self_demote" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("admin_users").update({ is_active: parsed.data.active }).eq("profile_id", parsed.data.profileId).select("profile_id");
  if (error) return { ok: false, error: errorCode(error) };
  if (!data?.length) return { ok: false, error: "forbidden" };
  revalidatePath("/admin/settings");
  revalidatePath("/admin", "layout");
  return { ok: true };
}
