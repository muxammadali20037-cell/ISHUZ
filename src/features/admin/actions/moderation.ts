"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/utils";
import type { ActionResult } from "@/features/auth/actions";
import { documentUrlSchema, moderateReviewSchema, resolveReportSchema, reviewVerificationSchema } from "../schema";
import { requirePerm } from "./guard";

/** Shikoyat holati → rpc admin_resolve_report (in_review / resolved / dismissed) */
export async function resolveReport(input: unknown): Promise<ActionResult> {
  const parsed = resolveReportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("reports.resolve");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_resolve_report", {
    p_report_id: parsed.data.reportId,
    p_status: parsed.data.status,
    p_note: parsed.data.note || undefined,
  });
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
  return { ok: true };
}

/** Sharh moderatsiyasi → rpc admin_moderate_review */
export async function moderateReview(input: unknown): Promise<ActionResult> {
  const parsed = moderateReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("reviews.moderate");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_moderate_review", {
    p_review_id: parsed.data.reviewId,
    p_status: parsed.data.status,
    p_note: parsed.data.note || undefined,
  });
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath("/admin/reviews");
  revalidatePath("/admin");
  return { ok: true };
}

/** Verifikatsiya so'rovi → rpc admin_review_verification (verified / rejected) */
export async function reviewVerification(input: unknown): Promise<ActionResult> {
  const parsed = reviewVerificationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("employers.verify");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_review_verification", {
    p_request_id: parsed.data.requestId,
    p_status: parsed.data.status,
    p_note: parsed.data.note || undefined,
  });
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath("/admin/verifications");
  revalidatePath("/admin/employers");
  revalidatePath("/admin");
  return { ok: true };
}

/** documents bucket'idagi hujjat uchun vaqtinchalik (10 daqiqa) imzolangan URL. Storage RLS: employers.verify */
export async function getDocumentUrl(input: unknown): Promise<ActionResult<{ url: string }>> {
  const parsed = documentUrlSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("employers.verify");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(parsed.data.path, 600);
  if (error || !data?.signedUrl) return { ok: false, error: error ? errorCode(error) : "not_found" };
  return { ok: true, data: { url: data.signedUrl } };
}
