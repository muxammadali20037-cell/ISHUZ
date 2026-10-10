import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export interface TelegramInitUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
}

/** initData yoshi: Mini App ochilgandan 1 soat ichida (qayta ishlatish oynasi qisqa) */
export const INIT_DATA_MAX_AGE_SECONDS = 60 * 60;
/** soat farqi uchun kichik zaxira (kelajakdagi auth_date) */
const CLOCK_SKEW_SECONDS = 60;

function safeEqualHex(expectedHex: string, actualHex: string) {
  const a = Buffer.from(expectedHex, "hex");
  const b = Buffer.from(actualHex, "hex");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/**
 * Telegram Mini App initData imzosini serverda tekshiradi.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * Muvaffaqiyatli bo'lsa foydalanuvchi obyektini, aks holda null qaytaradi.
 */
export function verifyTelegramInitData(initData: string, botToken: string, now = Date.now()): TelegramInitUser | null {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  if (!safeEqualHex(expected, hash)) return null;

  const authDate = Number(params.get("auth_date"));
  const age = now / 1000 - authDate;
  if (!authDate || age > INIT_DATA_MAX_AGE_SECONDS || age < -CLOCK_SKEW_SECONDS) return null;

  try {
    const user = JSON.parse(params.get("user") ?? "null") as TelegramInitUser | null;
    return user && typeof user.id === "number" ? user : null;
  } catch {
    return null;
  }
}
