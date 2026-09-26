"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/features/auth/session";
import type { ActionResult } from "@/features/auth/actions";
import { errorCode } from "@/lib/utils";
import { createReviewSchema, setApplicationStatusSchema, withdrawApplicationSchema } from "./schema";
import type { ApplicationStatus } from "./types";

/** Ishchi: arizani qaytarib olish (set_application_status → withdrawn) */
export async function withdrawApplication(input: unknown): Promise<ActionResult> {
  const parsed = withdrawApplicationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  if (!session.workerId) return { ok: false, error: "forbidden" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_application_status", { p_application_id: parsed.data.applicationId, p_status: "withdrawn" });
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath("/applications");
  revalidatePath(`/applications/${parsed.data.applicationId}`);
  return { ok: true };
}

/** Ish beruvchi: ariza holatini o'zgartirish (shortlisted / interview / offered / hired / rejected) */
export async function setApplicationStatus(input: unknown): Promise<ActionResult<{ status: ApplicationStatus }>> {
  const parsed = setApplicationStatusSchema.safeParse(input);
  if (!parsed.success) {
    const noteIssue = parsed.error.issues.find((i) => i.path[0] === "note");
    return { ok: false, error: noteIssue ? "note_required" : "validation" };
  }
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  if (!session.employerId) return { ok: false, error: "forbidden" };
  const supabase = await createClient();
  const { applicationId, vacancyId, status, note } = parsed.data;
  const { error } = await supabase.rpc("set_application_status", { p_application_id: applicationId, p_status: status, p_note: note || undefined });
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath(`/employer/vacancies/${vacancyId}`);
  revalidatePath(`/employer/vacancies/${vacancyId}/applications`);
  revalidatePath(`/employer/vacancies/${vacancyId}/applications/${applicationId}`);
  revalidatePath(`/applications/${applicationId}`);
  return { ok: true, data: { status } };
}

/**
 * Sharh: ishga qabul qilingan ariza (hired) yoki ishga olingan taklif (hired_at) bo'yicha.
 * Ishchi → ish beruvchini, ish beruvchi → nomzodni baholaydi (RPC create_review hal qiladi).
 */
export async function createReview(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { applicationId, offerId, rating, text, vacancyId } = parsed.data;
  const { data, error } = await supabase.rpc("create_review", {
    p_application_id: applicationId,
    p_job_offer_id: offerId,
    p_rating: rating,
    p_text: text || undefined,
  });
  if (error) {
    if ((error as { code?: string }).code === "23505") return { ok: false, error: "review_exists" };
    return { ok: false, error: errorCode(error) };
  }
  if (applicationId) {
    revalidatePath(`/applications/${applicationId}`);
    if (vacancyId) revalidatePath(`/employer/vacancies/${vacancyId}/applications/${applicationId}`);
  }
  if (offerId) {
    revalidatePath("/offers");
    revalidatePath(`/offers/${offerId}`);
  }
  return { ok: true, data: { id: data } };
}
