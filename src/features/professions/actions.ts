"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/features/auth/actions";
import { getSession } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Constants } from "@/types/database.types";

/*
 * Ishchining kasblari: asosiy (worker_profiles.profession_node_id) + qo'shimcha (worker_professions, 5 tagacha,
 * har biriga alohida tajriba). RLS: faqat o'z profili; mijozga ishonilmaydi — sessiyadan worker aniqlanadi.
 */

const uuid = z.uuid();
const experience = z.enum(Constants.public.Enums.experience_level);

async function ctx() {
  const session = await getSession();
  if (!session) return { error: "not_authenticated" as const };
  if (!session.workerId) return { error: "forbidden" as const };
  return { workerId: session.workerId, supabase: await createClient() };
}

async function activeSelectable(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data } = await supabase.from("profession_nodes").select("id").eq("id", id).eq("is_active", true).eq("selectable", true).maybeSingle();
  return !!data;
}

function done() {
  revalidatePath("/profile/profession");
  revalidatePath("/profile");
  revalidatePath("/");
}

export async function setPrimaryProfession(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ nodeId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const c = await ctx();
  if ("error" in c) return { ok: false, error: c.error! };
  if (!(await activeSelectable(c.supabase, parsed.data.nodeId))) return { ok: false, error: "validation" };
  const { error } = await c.supabase.from("worker_profiles").update({ profession_node_id: parsed.data.nodeId }).eq("id", c.workerId);
  if (error) return { ok: false, error: "generic" };
  // asosiy kasb qo'shimchalar ro'yxatida takrorlanmasin
  await c.supabase.from("worker_professions").delete().eq("worker_id", c.workerId).eq("node_id", parsed.data.nodeId);
  done();
  return { ok: true };
}

export async function saveExtraProfession(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ nodeId: uuid, experience }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const c = await ctx();
  if ("error" in c) return { ok: false, error: c.error! };
  if (!(await activeSelectable(c.supabase, parsed.data.nodeId))) return { ok: false, error: "validation" };
  const { error } = await c.supabase
    .from("worker_professions")
    .upsert({ worker_id: c.workerId, node_id: parsed.data.nodeId, experience_level: parsed.data.experience }, { onConflict: "worker_id,node_id" });
  if (error) return { ok: false, error: /too_many_professions/.test(error.message) ? "too_many_professions" : "generic" };
  done();
  return { ok: true };
}

export async function removeExtraProfession(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ nodeId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const c = await ctx();
  if ("error" in c) return { ok: false, error: c.error! };
  const { error } = await c.supabase.from("worker_professions").delete().eq("worker_id", c.workerId).eq("node_id", parsed.data.nodeId);
  if (error) return { ok: false, error: "generic" };
  done();
  return { ok: true };
}
