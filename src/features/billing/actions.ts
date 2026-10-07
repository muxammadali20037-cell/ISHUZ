"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/features/auth/session";
import type { ActionResult } from "@/features/auth/actions";
import { getLocale } from "@/lib/i18n/server";
import { getServerEnv } from "@/lib/env";
import { isAndroidApp } from "@/lib/app-platform.server";
import { errorCode } from "@/lib/utils";
import { checkoutUrl, enabledProviders } from "./providers";
import type { ListingQuote, PromotionQuote, VacancyQuote } from "./types";

const uuid = z.uuid();

export async function getVacancyQuote(vacancyId: string): Promise<ActionResult<VacancyQuote>> {
  if (!uuid.safeParse(vacancyId).success) return { ok: false, error: "validation" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("vacancy_publish_quote", { p_vacancy_id: vacancyId });
  if (error || !data) return { ok: false, error: errorCode(error) };
  return { ok: true, data: { ...(data as unknown as Omit<VacancyQuote, "providers">), providers: enabledProviders() } };
}

export async function getPromotionQuote(): Promise<ActionResult<PromotionQuote>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("worker_promotion_quote");
  if (error || !data) return { ok: false, error: errorCode(error) };
  return { ok: true, data: { ...(data as unknown as Omit<PromotionQuote, "providers">), providers: enabledProviders() } };
}

/** Ish qidiruvchi e'loni (10 kun): rejim, narx, muddat */
export async function getWorkerListingQuote(): Promise<ActionResult<ListingQuote>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("worker_listing_quote");
  if (error || !data) return { ok: false, error: errorCode(error) };
  return { ok: true, data: { ...(data as unknown as Omit<ListingQuote, "providers">), providers: enabledProviders() } };
}

const checkoutSchema = z.object({
  purpose: z.enum(["vacancy_publish", "worker_promotion", "worker_listing"]),
  targetId: uuid,
  provider: z.enum(["payme", "click"]),
});

/** To'lov yaratadi (narx serverda, sozlamalardan) va to'lov tizimi sahifasiga havola qaytaradi */
export async function startCheckout(input: unknown): Promise<ActionResult<{ url: string }>> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  if (!enabledProviders().includes(parsed.data.provider)) return { ok: false, error: "provider_disabled" };
  // Google Play ilovasi ichida raqamli xizmat Payme/Click orqali sotilmaydi
  if (await isAndroidApp()) return { ok: false, error: "in_app_unavailable" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_payment", { p_purpose: parsed.data.purpose, p_target_id: parsed.data.targetId });
  if (error || !data) return { ok: false, error: errorCode(error) };
  const payment = data as { id: string; order_no: number; amount: number };
  const returnUrl = `${getServerEnv().APP_URL.replace(/\/$/, "")}/billing/return?order=${payment.order_no}`;
  return { ok: true, data: { url: checkoutUrl(parsed.data.provider, payment.order_no, payment.amount, returnUrl, await getLocale()) } };
}

/** TOP: bepul/aksiya bo'lsa darhol yoqiladi; aks holda "payment_required" */
export async function promoteWorker(): Promise<ActionResult<{ until: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("promote_worker");
  if (error || !data) return { ok: false, error: errorCode(error) };
  revalidatePath("/");
  return { ok: true, data: { until: data } };
}
