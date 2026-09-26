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
  const { error } = await supabase.from("reports").insert({
    reporter_profile_id: session.userId,
    target_type: parsed.data.targetType,
    target_id: parsed.data.targetId,
    reason: parsed.data.reason,
    details: parsed.data.details?.trim() || null,
  });
  if (error) return { ok: false, error: errorCode(error) };
  return { ok: true };
}
