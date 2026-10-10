"use server";

import { revalidatePath, updateTag } from "next/cache";
import { REFERENCE_TAG } from "@/lib/supabase/public";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/utils";
import type { ActionResult } from "@/features/auth/actions";
import { requirePerm } from "./guard";

/*
 * Kasblar daraxti (profession_nodes) — admin. RLS: categories.manage.
 * Tarix: bazadagi trigger (profession.create / profession.update / profession.merge) audit_logs ga yozadi.
 * Ishlatilgan tugun o'chirilmaydi — nofaol qilinadi yoki boshqasiga birlashtiriladi.
 */

const uuid = z.uuid();
const text = (min: number, max: number) => z.string().trim().min(min).max(max);

const nodeSchema = z.object({
  id: uuid.optional(),
  parentId: uuid.nullable(),
  categoryId: uuid,
  nameUz: text(2, 120),
  nameRu: text(2, 120),
  nameEn: z.string().trim().max(120).optional().default(""),
  icon: z.string().trim().max(40).optional().default(""),
  aliases: z.string().max(2000).optional().default(""),
  selectable: z.boolean(),
  isPopular: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(100000),
});

/** "svarchik, сварщик\nwelder" → ["svarchik", "сварщик", "welder"] */
function parseAliases(raw: string): string[] {
  return [...new Set(raw.split(/[,;\n]/).map((a) => a.trim().toLowerCase()).filter((a) => a.length >= 2 && a.length <= 60))].slice(0, 60);
}

function slugify(s: string): string {
  const base = s
    .toLowerCase()
    .replace(/[‘’ʻʼ`']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return `${base || "node"}-${Math.random().toString(36).slice(2, 7)}`;
}

function revalidate() {
  // kasblar daraxti keshi — darhol yangilanadi
  updateTag(REFERENCE_TAG);
  revalidatePath("/admin/professions");
  revalidatePath("/admin/audit");
}

export async function saveProfessionNode(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = nodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("categories.manage");
  if (!guard.ok) return guard;
  const d = parsed.data;
  const supabase = await createClient();
  const values = {
    name_uz: d.nameUz,
    name_ru: d.nameRu,
    name_en: d.nameEn || null,
    icon: d.icon || null,
    aliases: parseAliases(d.aliases),
    selectable: d.selectable,
    is_popular: d.isPopular,
    is_active: d.isActive,
    sort_order: d.sortOrder,
  };
  const q = d.id
    ? supabase.from("profession_nodes").update(values).eq("id", d.id).select("id").single()
    : supabase
        .from("profession_nodes")
        .insert({ ...values, parent_id: d.parentId, category_id: d.categoryId, slug: slugify(d.nameEn || d.nameUz), kind: d.selectable ? "profession" : "group" })
        .select("id")
        .single();
  const { data, error } = await q;
  if (error) return { ok: false, error: errorCode(error) };
  revalidate();
  return { ok: true, data: { id: data.id } };
}

/** Tugunni boshqa ota ostiga ko'chirish (yo'l va bolalar bazada qayta hisoblanadi; sikl taqiqlangan) */
export async function moveProfessionNode(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, parentId: uuid.nullable() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("categories.manage");
  if (!guard.ok) return guard;
  if (parsed.data.id === parsed.data.parentId) return { ok: false, error: "validation" };
  const supabase = await createClient();
  const { error } = await supabase.from("profession_nodes").update({ parent_id: parsed.data.parentId }).eq("id", parsed.data.id);
  if (error) return { ok: false, error: /cycle/.test(error.message) ? "cycle_detected" : errorCode(error) };
  revalidate();
  return { ok: true };
}

/** Dublikatni birlashtirish: profillar, vakansiyalar, bolalar va savollar yangi tugunga o'tadi, eski nomi sinonim bo'ladi */
export async function mergeProfessionNode(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ from: uuid, into: uuid }).safeParse(input);
  if (!parsed.success || parsed.data.from === parsed.data.into) return { ok: false, error: "validation" };
  const guard = await requirePerm("categories.manage");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_merge_profession_node", { p_from: parsed.data.from, p_into: parsed.data.into });
  if (error) return { ok: false, error: /descendant/.test(error.message) ? "cycle_detected" : errorCode(error) };
  revalidate();
  return { ok: true };
}
