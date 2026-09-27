import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { getServerEnv } from "@/lib/env";

export type PaymentProvider = "payme" | "click";

/** Sozlangan to'lov tizimlari (kalitlar Vercel env'da) */
export function enabledProviders(): PaymentProvider[] {
  const env = getServerEnv();
  const list: PaymentProvider[] = [];
  if (env.PAYME_MERCHANT_ID && env.PAYME_KEY) list.push("payme");
  if (env.CLICK_SERVICE_ID && env.CLICK_MERCHANT_ID && env.CLICK_SECRET_KEY) list.push("click");
  return list;
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** To'lov sahifasi: summa so'mda, Payme'ga tiyinda (×100) */
export function checkoutUrl(provider: PaymentProvider, orderNo: number | string, amount: number, returnUrl: string, locale: string): string {
  const env = getServerEnv();
  if (provider === "payme") {
    const base = env.PAYME_TEST ? "https://checkout.test.paycom.uz" : "https://checkout.paycom.uz";
    const params = `m=${env.PAYME_MERCHANT_ID};ac.order_id=${orderNo};a=${amount * 100};c=${returnUrl};l=${locale === "ru" ? "ru" : "uz"}`;
    return `${base}/${Buffer.from(params).toString("base64")}`;
  }
  const q = new URLSearchParams({
    service_id: env.CLICK_SERVICE_ID ?? "",
    merchant_id: env.CLICK_MERCHANT_ID ?? "",
    amount: String(amount),
    transaction_param: String(orderNo),
    return_url: returnUrl,
  });
  return `https://my.click.uz/services/pay?${q.toString()}`;
}

/** Payme: Authorization: Basic base64("Paycom:<KEY>") */
export function verifyPaymeAuth(header: string | null): boolean {
  const key = getServerEnv().PAYME_KEY;
  if (!key || !header?.startsWith("Basic ")) return false;
  let decoded = "";
  try {
    decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  } catch {
    return false;
  }
  const password = decoded.slice(decoded.indexOf(":") + 1);
  return decoded.startsWith("Paycom:") && safeEqual(password, key);
}

/**
 * Click imzosi: md5(click_trans_id + service_id + SECRET + merchant_trans_id [+ merchant_prepare_id] + amount + action + sign_time)
 * amount — Click yuborgan satr ko'rinishida (masalan "50000" yoki "50000.00").
 */
export function clickSign(f: Record<string, string>, secret: string): string {
  const parts = [f.click_trans_id, f.service_id, secret, f.merchant_trans_id, f.action === "1" ? f.merchant_prepare_id : "", f.amount, f.action, f.sign_time];
  return createHash("md5").update(parts.map((p) => p ?? "").join("")).digest("hex");
}

export function verifyClickSign(f: Record<string, string>): boolean {
  const env = getServerEnv();
  if (!env.CLICK_SECRET_KEY || f.service_id !== env.CLICK_SERVICE_ID) return false;
  return safeEqual(clickSign(f, env.CLICK_SECRET_KEY), (f.sign_string ?? "").toLowerCase());
}
