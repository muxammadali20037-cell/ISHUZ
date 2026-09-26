"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/features/auth/session";
import type { ActionResult } from "@/features/auth/actions";
import { errorCode } from "@/lib/utils";
import { offerIdSchema, respondOfferSchema } from "./schema";
import type { OfferStatus } from "./types";

function revalidateOffer(offerId: string, vacancyId?: string) {
  revalidatePath("/offers");
  revalidatePath(`/offers/${offerId}`);
  revalidatePath("/applications");
  if (vacancyId) revalidatePath(`/employer/vacancies/${vacancyId}/applications`);
}

/** Ishchi: taklifni qabul qilish / rad etish (respond_offer) */
export async function respondToOffer(input: unknown): Promise<ActionResult<{ status: OfferStatus }>> {
  const parsed = respondOfferSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  if (!session.workerId) return { ok: false, error: "worker_profile_required" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_offer", { p_offer_id: parsed.data.offerId, p_accept: parsed.data.accept });
  if (error) {
    revalidateOffer(parsed.data.offerId); // offer_expired: RPC statusni 'expired' qilgan bo'lishi mumkin
    return { ok: false, error: errorCode(error) };
  }
  revalidateOffer(parsed.data.offerId);
  return { ok: true, data: { status: parsed.data.accept ? "accepted" : "declined" } };
}

/** Ish beruvchi: taklifni qaytarib olish (withdraw_offer — faqat sent/viewed). RPC jim ishlaydi, natija qayta o'qiladi. */
export async function withdrawOffer(input: unknown): Promise<ActionResult> {
  const parsed = offerIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  if (!session.employerId) return { ok: false, error: "forbidden" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_offer", { p_offer_id: parsed.data.offerId });
  if (error) return { ok: false, error: errorCode(error) };
  const { data: after } = await supabase.from("job_offers").select("status").eq("id", parsed.data.offerId).maybeSingle();
  if (!after) return { ok: false, error: "not_found" };
  if (after.status !== "withdrawn") return { ok: false, error: "offer_closed" };
  revalidateOffer(parsed.data.offerId, parsed.data.vacancyId);
  return { ok: true };
}

/** Ish beruvchi: qabul qilingan taklif bo'yicha nomzod ishga olindi (mark_offer_hired) */
export async function markOfferHired(input: unknown): Promise<ActionResult> {
  const parsed = offerIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  if (!session.employerId) return { ok: false, error: "forbidden" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_offer_hired", { p_offer_id: parsed.data.offerId });
  if (error) return { ok: false, error: errorCode(error) };
  revalidateOffer(parsed.data.offerId, parsed.data.vacancyId);
  return { ok: true };
}
