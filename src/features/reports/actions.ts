"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/auth/actions";
import { getSession } from "@/features/auth/session";
import { errorCode } from "@/lib/utils";

const schema = z.object({
  targetType: z.enum(["profile", "vacancy", "company", "message", "review"]),
  targetId: z.string().min(1),
  reason: z.enum(["fraud", "fake_vacancy", "asked_money", "wrong_info", "spam", "abuse", "other"]),
  details: z.string().max(2000).optional(),
});

export type ReportInput = z.infer<typeof schema>;

/** Shikoyat yuborish (profil, vakansiya, kompaniya, xabar, sharh) */
export async function submitReport(input: ReportInput): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  // RPC: blok tekshiruvi + rate limit + takroriy shikoyatdan himoya
  const { error } = await supabase.rpc("submit_report", {
    p_target_type: parsed.data.targetType,
    p_target_id: parsed.data.targetId,
    p_reason: parsed.data.reason,
    p_details: parsed.data.details?.trim() || undefined,
  });
  if (error) return { ok: false, error: errorCode(error) };
  return { ok: true };
}
