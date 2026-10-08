"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/utils";
import type { ActionResult } from "@/features/auth/actions";
import { moderateNow } from "@/features/moderation/service";
import { employerStatusSchema, matchingSchema, moderationDecideSchema, retryQueueSchema } from "../schema";
import { requirePerm } from "./guard";

/** Moderatsiya qarori → rpc admin_moderation_decide (aynan joriy versiyaga; audit bilan) */
export async function decideModeration(input: unknown): Promise<ActionResult<{ result: string }>> {
  const parsed = moderationDecideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message === "message_required" ? "message_required" : "validation" };
  const guard = await requirePerm("vacancies.moderate");
  if (!guard.ok) return guard;
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_moderation_decide", {
    p_entity: v.entity,
    p_id: v.id,
    p_decision: v.decision,
    p_message: v.message || undefined,
    p_category: v.category,
  });
  if (error) return { ok: false, error: errorCode(error) };
  // qayta tekshiruv — darhol navbatdan (cron ham baribir oladi)
  if (v.decision === "recheck") after(() => moderateNow(v.entity, v.id));
  revalidatePath("/admin/moderation");
  revalidatePath("/admin");
  return { ok: true, data: { result: String(data ?? "") } };
}

/** Ish beruvchi holati: tasdiqlash (nima tekshirilgani bilan) / rad etish / to'xtatish → rpc admin_set_employer_status */
export async function setEmployerStatus(input: unknown): Promise<ActionResult<{ activated: number }>> {
  const parsed = employerStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message === "message_required" ? "message_required" : "validation" };
  const guard = await requirePerm("employers.verify");
  if (!guard.ok) return guard;
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_employer_status", {
    p_profile_id: v.profileId,
    p_status: v.status,
    p_checks: v.status === "verified" ? v.checks : [],
    p_note: v.note || undefined,
  });
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath("/admin/employers");
  revalidatePath("/admin/verifications");
  revalidatePath("/admin");
  return { ok: true, data: { activated: Number(data ?? 0) } };
}

/** Moslik og'irliklari va xabar chegarasi → rpc admin_update_matching (versiya oshadi, audit; eski xabarlar qayta yuborilmaydi) */
export async function updateMatching(input: unknown): Promise<ActionResult<{ version: number }>> {
  const parsed = matchingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message === "weights_must_sum_100" ? "weights_must_sum_100" : "validation" };
  const guard = await requirePerm("settings.manage");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_update_matching", { p_weights: parsed.data.weights, p_threshold: parsed.data.threshold });
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath("/admin/matching");
  return { ok: true, data: { version: Number(data ?? 0) } };
}

/** Navbatni qayta urinish → rpc admin_retry_queue (audit) */
export async function retryQueue(input: unknown): Promise<ActionResult<{ count: number }>> {
  const parsed = retryQueueSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("settings.manage");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_retry_queue", { p_kind: parsed.data.kind });
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath("/admin/queues");
  return { ok: true, data: { count: Number(data ?? 0) } };
}
