import type { TFunction } from "@/lib/i18n/translate";
import { actionErrorMessage } from "../../i18n-helpers";

/** RHF/zod xato xabari (i18n kaliti sifatida yozilgan) → matn */
export function fieldError(t: TFunction, message: string | undefined, params?: Record<string, string | number>): string | undefined {
  if (!message) return undefined;
  return actionErrorMessage(t, message, params);
}

/** Yillar ro'yxati (kamayish tartibida) */
export function yearOptions(from: number, to: number): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let y = to; y >= from; y--) out.push({ value: String(y), label: String(y) });
  return out;
}

/** "12345" → 12345, bo'sh → null */
export function parseMoney(v: string): number | null {
  const digits = v.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

/** 5000000 → "5 000 000" (input ichida ko'rsatish uchun) */
export function groupDigits(n: number | null): string {
  if (n === null) return "";
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
