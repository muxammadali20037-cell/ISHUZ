import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export interface TelegramInitUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
}

const MAX_AGE_SECONDS = 24 * 60 * 60;

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
  if (!authDate || now / 1000 - authDate > MAX_AGE_SECONDS) return null;

  try {
    const user = JSON.parse(params.get("user") ?? "null") as TelegramInitUser | null;
    return user && typeof user.id === "number" ? user : null;
  } catch {
    return null;
  }
}

/**
 * Telegram Login Widget ma'lumotlarini tekshiradi (sayt uchun).
 * https://core.telegram.org/widgets/login#checking-authorization
 * secret_key = SHA256(bot_token)
 */
export function verifyTelegramLoginWidget(data: Record<string, string>, botToken: string, now = Date.now()): TelegramInitUser | null {
  const { hash, ...rest } = data;
  if (!hash) return null;
  const dataCheckString = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join("\n");
  const secretKey = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (!safeEqualHex(expected, hash)) return null;
  const authDate = Number(rest.auth_date);
  if (!authDate || now / 1000 - authDate > MAX_AGE_SECONDS) return null;
  const id = Number(rest.id);
  if (!Number.isFinite(id)) return null;
  return { id, first_name: rest.first_name ?? "", last_name: rest.last_name, username: rest.username, photo_url: rest.photo_url };
}
