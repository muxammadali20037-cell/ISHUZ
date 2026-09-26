"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/utils";
import type { ActionResult } from "@/features/auth/actions";
import { categorySchema, districtSchema, regionSchema, skillUpdateSchema, subcategorySchema, uuid } from "../schema";
import { requirePerm } from "./guard";

/*
 * Ma'lumotnoma jadvallariga to'g'ridan-to'g'ri yozish (RLS: categories.manage / skills.manage / regions.manage).
 * DIQQAT: bu amallar hozircha audit_logs ga yozilmaydi (write_audit faqat service_role) —
 * docs/db-requests/admin.md da admin_log RPC so'ralgan. UI da "audit yozilmaydi" belgisi ko'rsatiladi.
 */

const idSchema = z.object({ id: uuid });

function revalidateRef() {
  revalidatePath("/admin/categories");
  revalidatePath("/admin/skills");
  revalidatePath("/admin/regions");
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
  const q = id ? supabase.from("categories").update(payload).eq("id", id).select("id").single() : supabase.from("categories").insert(payload).select("id").single();
  const { data, error } = await q;
  if (error) return { ok: false, error: error.code === "23505" ? "duplicate" : errorCode(error) };
  revalidateRef();
  return { ok: true, data: { id: data.id } };
}

export async function deleteCategory(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("categories.manage");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.code === "23503" ? "in_use" : errorCode(error) };
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
  const q = id ? supabase.from("subcategories").update(values).eq("id", id).select("id").single() : supabase.from("subcategories").insert(values).select("id").single();
  const { data, error } = await q;
  if (error) return { ok: false, error: error.code === "23505" ? "duplicate" : errorCode(error) };
  revalidateRef();
  return { ok: true, data: { id: data.id } };
}

export async function deleteSubcategory(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("categories.manage");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { error } = await supabase.from("subcategories").delete().eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.code === "23503" ? "in_use" : errorCode(error) };
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
  const { error } = await supabase.from("skills").update(values).eq("id", id);
  if (error) return { ok: false, error: error.code === "23505" ? "duplicate" : errorCode(error) };
  revalidateRef();
  return { ok: true };
}

export async function setSkillApproved(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, approved: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("skills.manage");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { error } = await supabase.from("skills").update({ is_approved: parsed.data.approved }).eq("id", parsed.data.id);
  if (error) return { ok: false, error: errorCode(error) };
  revalidateRef();
  return { ok: true };
}

export async function deleteSkill(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("skills.manage");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { error } = await supabase.from("skills").delete().eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.code === "23503" ? "in_use" : errorCode(error) };
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
  const q = id ? supabase.from("regions").update(values).eq("id", id).select("id").single() : supabase.from("regions").insert(values).select("id").single();
  const { data, error } = await q;
  if (error) return { ok: false, error: error.code === "23505" ? "duplicate" : errorCode(error) };
  revalidateRef();
  return { ok: true, data: { id: data.id } };
}

export async function deleteRegion(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("regions.manage");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { error } = await supabase.from("regions").delete().eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.code === "23503" ? "in_use" : errorCode(error) };
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
  const q = id ? supabase.from("districts").update(values).eq("id", id).select("id").single() : supabase.from("districts").insert(values).select("id").single();
  const { data, error } = await q;
  if (error) return { ok: false, error: error.code === "23505" ? "duplicate" : errorCode(error) };
  revalidateRef();
  return { ok: true, data: { id: data.id } };
}

export async function deleteDistrict(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("regions.manage");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { error } = await supabase.from("districts").delete().eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.code === "23503" ? "in_use" : errorCode(error) };
  revalidateRef();
  return { ok: true };
}
