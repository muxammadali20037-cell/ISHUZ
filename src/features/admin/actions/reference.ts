"use server";

import { revalidatePath, updateTag } from "next/cache";
import { REFERENCE_TAG } from "@/lib/supabase/public";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/utils";
import type { ActionResult } from "@/features/auth/actions";
import { categorySchema, districtSchema, regionSchema, skillUpdateSchema, subcategorySchema, uuid } from "../schema";
import { logAdmin, requirePerm, snapshot } from "./guard";

/*
 * Ma'lumotnoma jadvallariga to'g'ridan-to'g'ri yozish (RLS: categories.manage / skills.manage / regions.manage).
 * Har yozuvdan keyin rpc admin_log(action, target_type, target_id, before, after) → audit_logs.
 */

const idSchema = z.object({ id: uuid });

function revalidateRef() {
  // ochiq ma'lumotnoma keshi (kategoriya, hudud, ko'nikma) — darhol yangilanadi
  updateTag(REFERENCE_TAG);
  revalidatePath("/admin/categories");
  revalidatePath("/admin/skills");
  revalidatePath("/admin/regions");
  revalidatePath("/admin/audit");
  revalidatePath("/", "layout");
}

// ---------- kategoriyalar ----------
export async function saveCategory(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("categories.manage");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { id, ...values } = parsed.data;
  const payload = { ...values, icon: values.icon || null };
  const before = id ? (await supabase.from("categories").select("*").eq("id", id).maybeSingle()).data : null;
  const q = id ? supabase.from("categories").update(payload).eq("id", id).select("*").single() : supabase.from("categories").insert(payload).select("*").single();
  const { data, error } = await q;
  if (error) return { ok: false, error: error.code === "23505" ? "duplicate" : errorCode(error) };
  await logAdmin(supabase, id ? "category.update" : "category.create", "category", data.id, snapshot(before), snapshot(data));
  revalidateRef();
  return { ok: true, data: { id: data.id } };
}

export async function deleteCategory(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("categories.manage");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { data: before } = await supabase.from("categories").select("*").eq("id", parsed.data.id).maybeSingle();
  const { error } = await supabase.from("categories").delete().eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.code === "23503" ? "in_use" : errorCode(error) };
  await logAdmin(supabase, "category.delete", "category", parsed.data.id, snapshot(before), null);
  revalidateRef();
  return { ok: true };
}

export async function saveSubcategory(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = subcategorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("categories.manage");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { id, ...values } = parsed.data;
  const before = id ? (await supabase.from("subcategories").select("*").eq("id", id).maybeSingle()).data : null;
  const q = id ? supabase.from("subcategories").update(values).eq("id", id).select("*").single() : supabase.from("subcategories").insert(values).select("*").single();
  const { data, error } = await q;
  if (error) return { ok: false, error: error.code === "23505" ? "duplicate" : errorCode(error) };
  await logAdmin(supabase, id ? "subcategory.update" : "subcategory.create", "subcategory", data.id, snapshot(before), snapshot(data));
  revalidateRef();
  return { ok: true, data: { id: data.id } };
}

export async function deleteSubcategory(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("categories.manage");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { data: before } = await supabase.from("subcategories").select("*").eq("id", parsed.data.id).maybeSingle();
  const { error } = await supabase.from("subcategories").delete().eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.code === "23503" ? "in_use" : errorCode(error) };
  await logAdmin(supabase, "subcategory.delete", "subcategory", parsed.data.id, snapshot(before), null);
  revalidateRef();
  return { ok: true };
}

// ---------- ko'nikmalar ----------
export async function updateSkill(input: unknown): Promise<ActionResult> {
  const parsed = skillUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("skills.manage");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { id, ...values } = parsed.data;
  const { data: before } = await supabase.from("skills").select("*").eq("id", id).maybeSingle();
  const { data, error } = await supabase.from("skills").update(values).eq("id", id).select("*").maybeSingle();
  if (error) return { ok: false, error: error.code === "23505" ? "duplicate" : errorCode(error) };
  if (!data) return { ok: false, error: "forbidden" };
  await logAdmin(supabase, "skill.update", "skill", id, snapshot(before), snapshot(data));
  revalidateRef();
  return { ok: true };
}

export async function setSkillApproved(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, approved: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("skills.manage");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { data: before } = await supabase.from("skills").select("id, slug, name_uz, name_ru, is_approved, is_custom").eq("id", parsed.data.id).maybeSingle();
  const { data, error } = await supabase.from("skills").update({ is_approved: parsed.data.approved }).eq("id", parsed.data.id).select("id, is_approved").maybeSingle();
  if (error) return { ok: false, error: errorCode(error) };
  if (!data) return { ok: false, error: "forbidden" };
  await logAdmin(supabase, parsed.data.approved ? "skill.approve" : "skill.unapprove", "skill", parsed.data.id, snapshot(before), snapshot(data));
  revalidateRef();
  return { ok: true };
}

export async function deleteSkill(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("skills.manage");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { data: before } = await supabase.from("skills").select("*").eq("id", parsed.data.id).maybeSingle();
  const { error } = await supabase.from("skills").delete().eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.code === "23503" ? "in_use" : errorCode(error) };
  await logAdmin(supabase, "skill.delete", "skill", parsed.data.id, snapshot(before), null);
  revalidateRef();
  return { ok: true };
}

// ---------- hududlar ----------
export async function saveRegion(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = regionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("regions.manage");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { id, ...values } = parsed.data;
  const before = id ? (await supabase.from("regions").select("*").eq("id", id).maybeSingle()).data : null;
  const q = id ? supabase.from("regions").update(values).eq("id", id).select("*").single() : supabase.from("regions").insert(values).select("*").single();
  const { data, error } = await q;
  if (error) return { ok: false, error: error.code === "23505" ? "duplicate" : errorCode(error) };
  await logAdmin(supabase, id ? "region.update" : "region.create", "region", data.id, snapshot(before), snapshot(data));
  revalidateRef();
  return { ok: true, data: { id: data.id } };
}

export async function deleteRegion(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("regions.manage");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { data: before } = await supabase.from("regions").select("*").eq("id", parsed.data.id).maybeSingle();
  const { error } = await supabase.from("regions").delete().eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.code === "23503" ? "in_use" : errorCode(error) };
  await logAdmin(supabase, "region.delete", "region", parsed.data.id, snapshot(before), null);
  revalidateRef();
  return { ok: true };
}

export async function saveDistrict(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = districtSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("regions.manage");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { id, ...values } = parsed.data;
  const before = id ? (await supabase.from("districts").select("*").eq("id", id).maybeSingle()).data : null;
  const q = id ? supabase.from("districts").update(values).eq("id", id).select("*").single() : supabase.from("districts").insert(values).select("*").single();
  const { data, error } = await q;
  if (error) return { ok: false, error: error.code === "23505" ? "duplicate" : errorCode(error) };
  await logAdmin(supabase, id ? "district.update" : "district.create", "district", data.id, snapshot(before), snapshot(data));
  revalidateRef();
  return { ok: true, data: { id: data.id } };
}

export async function deleteDistrict(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("regions.manage");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { data: before } = await supabase.from("districts").select("*").eq("id", parsed.data.id).maybeSingle();
  const { error } = await supabase.from("districts").delete().eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.code === "23503" ? "in_use" : errorCode(error) };
  await logAdmin(supabase, "district.delete", "district", parsed.data.id, snapshot(before), null);
  revalidateRef();
  return { ok: true };
}
