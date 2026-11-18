import { createHash, randomBytes } from "node:crypto";

/**
 * Telegram orqali kodsiz kirish (0085; ega, 2026-11-18: "kod terib yurmasin, Telegram orqali shunday kirib ketsin").
 * Brauzer so'rov yaratadi → bot `/start w_<token>` → "✅ Kirish" → brauzer (o'sha cookie bilan) sessiya oladi.
 */
export const WEB_LOGIN_COOKIE = "ib_tgweb";
export const WEB_LOGIN_COOKIE_PATH = "/api/auth/telegram-web";
export const WEB_LOGIN_TTL_SECONDS = 5 * 60;
/** /start parametri: "w_" + 43 belgi (base64url) — Telegram chegarasi 64, [A-Za-z0-9_-] */
export const WEB_LOGIN_START_PREFIX = "w_";
export const WEB_LOGIN_TOKEN = /^[A-Za-z0-9_-]{43}$/;
/** callback_data: "wl:" + uuid (39 bayt ≤ 64) */
export const WEB_LOGIN_CALLBACK = /^wl:([0-9a-f-]{36})$/;

export function newSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** cookie qiymati: "<so'rov id>.<brauzer kaliti>" */
export function parseWebLoginCookie(raw: string | undefined): { id: string; nonce: string } | null {
  const m = raw?.match(/^([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/);
  return m ? { id: m[1]!, nonce: m[2]! } : null;
}

/** Botdagi tasdiq xabari uchun qisqa brauzer nomi: "Chrome · Android" (to'liq User-Agent saqlanmaydi) */
export function shortUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const os = /iPhone|iPad/.test(ua) ? (/iPad/.test(ua) ? "iPad" : "iPhone") : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : null;
  const browser = /YaBrowser/.test(ua)
    ? "Yandex"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Edg\//.test(ua)
        ? "Edge"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /SamsungBrowser/.test(ua)
            ? "Samsung Internet"
            : /Chrome\//.test(ua)
              ? "Chrome"
              : /Safari\//.test(ua)
                ? "Safari"
                : null;
  const parts = [browser, os].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
