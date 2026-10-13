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
import { isMissingRelation } from "@/features/saved/missing";
import { checkoutUrl, enabledProviders } from "./providers";
import { loadWallet } from "./queries";
import type { CheckoutPurpose, CheckoutQuote, ListingQuote, PromotionQuote, VacancyQuote } from "./types";

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

const purposeSchema = z.enum(["vacancy_publish", "worker_promotion", "worker_listing", "ai_alerts"]);
// ai_alerts — obuna foydalanuvchining o'ziga (obyekt yo'q); qolganlari — e'lon yoki ishchi profili
const targetSchema = z.object({ purpose: purposeSchema, targetId: uuid.nullish() }).refine((v) => v.purpose === "ai_alerts" || !!v.targetId, { message: "target" });
const checkoutSchema = z.intersection(targetSchema, z.object({ provider: z.enum(["payme", "click"]) }));

const returnUrl = (orderNo: number) => `${getServerEnv().APP_URL.replace(/\/$/, "")}/billing/return?order=${orderNo}`;

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
  const target = parsed.data.purpose === "ai_alerts" ? session.userId : parsed.data.targetId!;
  const { data, error } = await supabase.rpc("create_payment", { p_purpose: parsed.data.purpose, p_target_id: target });
  if (error || !data) return { ok: false, error: errorCode(error) };
  const payment = data as { id: string; order_no: number; amount: number };
  return { ok: true, data: { url: checkoutUrl(parsed.data.provider, payment.order_no, payment.amount, returnUrl(payment.order_no), await getLocale()) } };
}

/** To'lov oynasi uchun hammasi bitta so'rovda: narx, chegirma, muddat, usullar, hamyon balansi */
export async function getCheckout(input: unknown): Promise<ActionResult<CheckoutQuote>> {
  const parsed = targetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const { purpose, targetId } = parsed.data;
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const providers = enabledProviders();

  let quote: Omit<CheckoutQuote, "providers" | "wallet" | "purpose">;
  if (purpose === "ai_alerts") {
    const [paid, settings] = await Promise.all([
      supabase.rpc("ai_alerts_paid"),
      supabase.from("app_settings").select("key, value").in("key", ["price_ai_alerts", "ai_alerts_days"]),
    ]);
    const val = (k: string, d: number) => Number(settings.data?.find((r) => r.key === k)?.value ?? d) || d;
    const price = val("price_ai_alerts", 15000);
    quote = { mode: paid.data === false ? "free" : "payment_required", price, fullPrice: price, discountPercent: 0, discountUntil: null, days: val("ai_alerts_days", 30), hours: null };
  } else {
    const rpc =
      purpose === "vacancy_publish"
        ? await supabase.rpc("vacancy_publish_quote", { p_vacancy_id: targetId! })
        : purpose === "worker_listing"
          ? await supabase.rpc("worker_listing_quote")
          : await supabase.rpc("worker_promotion_quote");
    if (rpc.error || !rpc.data) return { ok: false, error: errorCode(rpc.error) };
    const q = rpc.data as Record<string, unknown>;
    const num = (k: string) => (typeof q[k] === "number" ? (q[k] as number) : null);
    const price = num("price") ?? 0;
    quote = {
      mode: String(q.mode ?? "payment_required"),
      price,
      fullPrice: num("full_price") ?? price,
      discountPercent: num("discount_percent") ?? 0,
      discountUntil: typeof q.discount_until === "string" ? q.discount_until : null,
      days: num("lifetime_days"),
      hours: num("hours"),
    };
  }
  const wallet = quote.mode === "payment_required" ? (await loadWallet(supabase)).wallet : null;
  return { ok: true, data: { purpose: purpose as CheckoutPurpose, ...quote, providers, wallet } };
}

const WALLET_ERRORS = ["insufficient_balance", "already_paid", "forbidden", "billing_disabled", "blocked", "rate_limited", "not_authenticated", "invalid_amount"];
function walletError(error: { message?: string; code?: string } | null, status?: number): string {
  if (isMissingRelation(error, status)) return "wallet_unavailable";
  const msg = error?.message ?? "";
  return WALLET_ERRORS.find((e) => msg.includes(e)) ?? errorCode(error);
}

/** Balansdan bir bosishda to'lash: narx, huquq va cheklovlar serverda (wallet_pay); yetmasa — insufficient_balance */
export async function payFromWallet(input: unknown): Promise<ActionResult<{ orderNo: number; balance: number }>> {
  const parsed = targetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  if (await isAndroidApp()) return { ok: false, error: "in_app_unavailable" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { data, error, status } = await supabase.rpc("wallet_pay", {
    p_purpose: parsed.data.purpose,
    p_target_id: parsed.data.purpose === "ai_alerts" ? null : parsed.data.targetId!,
  });
  if (error || !data) return { ok: false, error: walletError(error, status) };
  const res = data as { order_no: number; balance: number };
  for (const path of ["/", "/cabinet", "/billing", "/ai-alerts", "/profile/listing"]) revalidatePath(path);
  return { ok: true, data: { orderNo: Number(res.order_no), balance: Number(res.balance) } };
}

const topupSchema = z.object({ amount: z.number().int().positive().max(100_000_000), provider: z.enum(["payme", "click"]) });

/** Hamyonni to'ldirish: summa chegaralari serverda (create_topup); Payme/Click sahifasiga havola */
export async function startTopup(input: unknown): Promise<ActionResult<{ url: string }>> {
  const parsed = topupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_amount" };
  if (!enabledProviders().includes(parsed.data.provider)) return { ok: false, error: "provider_disabled" };
  if (await isAndroidApp()) return { ok: false, error: "in_app_unavailable" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { data, error, status } = await supabase.rpc("create_topup", { p_amount: parsed.data.amount });
  if (error || !data) return { ok: false, error: walletError(error, status) };
  const payment = data as { order_no: number; amount: number };
  return { ok: true, data: { url: checkoutUrl(parsed.data.provider, payment.order_no, payment.amount, returnUrl(payment.order_no), await getLocale()) } };
}

/** TOP: bepul/aksiya bo'lsa darhol yoqiladi; aks holda "payment_required" */
export async function promoteWorker(): Promise<ActionResult<{ until: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("promote_worker");
  if (error || !data) return { ok: false, error: errorCode(error) };
  revalidatePath("/");
  return { ok: true, data: { until: data } };
}
