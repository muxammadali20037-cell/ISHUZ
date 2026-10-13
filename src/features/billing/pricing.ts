/**
 * To'lov oynasi uchun sof hisob-kitoblar (serverda ham, brauzerda ham): kunlik narx, to'lov usullari tartibi,
 * hamyonni to'ldirish summalari va bonusi. Narxning o'zi doim serverda (create_payment / wallet_pay) hisoblanadi.
 */

/** Hamyonni to'ldirish — tayyor summalar (so'm) */
export const TOPUP_PRESETS = [20_000, 50_000, 100_000, 200_000] as const;

/** Oxirgi tanlangan to'lov usuli (shu qurilmada) — keyingi safar birinchi turadi */
export const LAST_PROVIDER_KEY = "ib_pay_provider";

/** Kuniga necha so'm: 100 so'mgacha yaxlitlangan; 1 kunlik yoki narxsiz xizmat uchun — null */
export function perDay(price: number, days: number | null | undefined): number | null {
  if (!days || days < 2 || !(price > 0)) return null;
  return Math.max(100, Math.round(price / days / 100) * 100);
}

/** Oxirgi ishlatilgan usul birinchi; qolganlari o'z tartibida */
export function orderProviders<T extends string>(providers: readonly T[], last: string | null | undefined): T[] {
  const preferred = providers.find((p) => p === last);
  return preferred ? [preferred, ...providers.filter((p) => p !== preferred)] : [...providers];
}

/** To'ldirish bonusi (serverdagi apply_payment_internal bilan bir xil qoida): chegaradan kam bo'lsa — 0; foiz 0–50 */
export function topupBonus(amount: number, percent: number, min: number): number {
  if (!(amount >= min) || !(percent > 0)) return 0;
  return Math.floor((amount * Math.min(50, percent)) / 100);
}

/** Foydalanuvchi yozgan summa: "50 000", "50000 so'm" → 50000; raqam bo'lmasa — null */
export function parseAmount(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits || digits.length > 9) return null;
  const n = Number(digits);
  return n > 0 ? n : null;
}

export type PaymentRowStatus = "paid" | "pending" | "unpaid" | "cancelled" | "failed";
const STALE_PENDING_MS = 60 * 60 * 1000;

/** To'lovlar tarixida holat: 1 soatdan eski "kutilmoqda" — "to'lanmagan" (Payme/Click sahifasi yopilgan, pul yechilmagan) */
export function rowStatus(status: string, createdAt: string, now = Date.now()): PaymentRowStatus {
  if (status === "pending") return now - new Date(createdAt).getTime() > STALE_PENDING_MS ? "unpaid" : "pending";
  return status === "paid" || status === "cancelled" || status === "failed" ? status : "failed";
}
