"use server";

import { createHash } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/auth/actions";
import { getSession } from "@/features/auth/session";
import { errorCode } from "@/lib/utils";
import { trackServer } from "@/features/analytics/server";

const schema = z.object({
  targetType: z.enum(["profile", "vacancy", "company", "message", "review", "ai_content"]),
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
  if (parsed.data.targetType === "vacancy") after(() => trackServer("vacancy_report", session.userId, { reason: parsed.data.reason }));
  return { ok: true };
}

const aiSchema = z.object({
  kind: z.enum(["listing_image", "ai_text"]),
  /** rasm havolasi yoki AI yozgan matn — admin nima yaratilganini ko'rsin */
  content: z.string().trim().min(1).max(4000),
  reason: z.enum(["abuse", "wrong_info", "other"]),
  details: z.string().max(500).optional(),
});

export type AiReportInput = z.infer<typeof aiSchema>;

/**
 * AI yaratgan natijaga shikoyat (0092; Google Play AI-Generated Content talabi): oddiy shikoyatlar navbatiga tushadi.
 * target_id — turi va mazmun izi (bir odam bir natijaga bir marta), details — nima yaratilgani va izoh.
 */
export async function reportAiContent(input: AiReportInput): Promise<ActionResult> {
  const parsed = aiSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const { kind, content, reason, details } = parsed.data;
  const targetId = `${kind}:${createHash("sha256").update(content).digest("hex").slice(0, 32)}`;
  const note = details?.trim();
  const body = [`[${kind}]`, content.slice(0, 1400), note ? `— ${note}` : null].filter(Boolean).join("\n");
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_report", { p_target_type: "ai_content", p_target_id: targetId, p_reason: reason, p_details: body.slice(0, 2000) });
  if (error) return { ok: false, error: errorCode(error) };
  return { ok: true };
}
