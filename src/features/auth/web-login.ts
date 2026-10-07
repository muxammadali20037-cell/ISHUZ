import "server-only";

import { createHash, randomBytes } from "node:crypto";

/** Brauzerdagi kutish cookie'si: token faqat shu brauzerda (httpOnly) */
export const WEB_LOGIN_COOKIE = "ib_wl";
/** Bot /start parametri prefiksi (Telegram: faqat [A-Za-z0-9_-], 64 gacha) */
export const WEB_LOGIN_START_PREFIX = "wl_";
/** Inline tugma callback prefiksi */
export const WEB_LOGIN_CALLBACK_PREFIX = "wl:";

export function newWebLoginToken(): string {
  return randomBytes(32).toString("base64url"); // 43 belgi
}

export function hashWebLoginToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isWebLoginToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** User-Agent dan qisqa nom: "Chrome · Windows" (botdagi tasdiqlash xabari uchun) */
export function describeUserAgent(ua: string | null): string {
  if (!ua) return "—";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /YaBrowser/.test(ua) ? "Yandex" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Brauzer";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} · ${os}` : browser;
}
