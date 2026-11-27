"use client";

import { useTelegram } from "./telegram/provider";
import { useAndroidApp } from "./use-android-app";

/**
 * Ilova ichida pullik xizmatni sotib bo'lmaydigan joy (narx va to'lov tugmalari o'rniga neytral izoh chiqadi):
 *  - "android"  — Google Play ilovasi (Play to'lov qoidasi: Play Billing yoki "faqat foydalanish");
 *  - "telegram" — Telegram Mini App (raqamli xizmat faqat Telegram Stars bilan; Payme/Click — saytda).
 * Serverda va birinchi chizishda — null (brauzer).
 */
export type PurchaseLock = "android" | "telegram";

export function usePurchaseLock(): PurchaseLock | null {
  const android = useAndroidApp();
  const { isTelegram } = useTelegram();
  if (android) return "android";
  if (isTelegram) return "telegram";
  return null;
}
