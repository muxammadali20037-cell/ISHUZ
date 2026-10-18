import { safeInternalPath } from "@/lib/security/safe-path";
import { isAdminPath } from "@/lib/admin-host";

/**
 * Admin uchun zaxira kirish: email + parol, keyin baribir autentifikator kodi (TOTP). Telegram ishlamay qolganda ham
 * panelga kirish mumkin bo'lsin. Oddiy foydalanuvchilar uchun emas — ular telefon/Telegram bilan kiradi.
 * Sof funksiyalar (unit test: admin-login.test.ts).
 */
export const ADMIN_PASSWORD_MIN = 12;
export const ADMIN_PASSWORD_MAX = 128;

/** Email va parol bilan kirish sahifasi */
export const ADMIN_LOGIN_PATH = "/auth/admin";
/** Parol o'rnatish / tiklash havolasini so'rash */
export const ADMIN_RECOVER_PATH = "/auth/admin/tiklash";
/** Emaildagi havola shu yerga qaytadi (#access_token=...) — kirgan foydalanuvchi ham ochishi mumkin (proxy uni chetlatmaydi) */
export const ADMIN_LINK_PATH = "/auth/admin/havola";
/** Panel ichida: email va parolni o'rnatish */
export const ADMIN_ACCOUNT_PATH = "/admin/account";

/** Telegram/telefon orqali yaratilgan hisoblarning texnik manzili (tg_<id>@telegram.ishuz.local) — haqiqiy email emas */
const TECHNICAL_DOMAIN = "@telegram.ishuz.local";

export function isTechnicalEmail(email: string | null | undefined): boolean {
  return !email || email.trim().toLowerCase().endsWith(TECHNICAL_DOMAIN);
}

/** Kiritilgan email → kichik harfli, bo'shliqsiz; noto'g'ri yoki texnik manzil — null */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (v.length < 6 || v.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/.test(v)) return null;
  if (isTechnicalEmail(v)) return null;
  return v;
}

export type PasswordProblem = "too_short" | "too_long" | "too_simple" | "contains_email";

/**
 * Parol qoidasi (server ham, forma ham shu bilan tekshiradi): 12–128 belgi, kamida 5 xil belgi ("aaaaaaaaaaaa",
 * "121212121212" emas), email nomini o'z ichiga olmaydi. Majburiy "katta harf + raqam" yo'q — uzun ibora yaxshiroq.
 */
export function passwordProblem(password: string, email?: string | null): PasswordProblem | null {
  if (password.length < ADMIN_PASSWORD_MIN) return "too_short";
  if (password.length > ADMIN_PASSWORD_MAX) return "too_long";
  if (new Set(password.toLowerCase()).size < 5) return "too_simple";
  const local = email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && password.toLowerCase().includes(local)) return "contains_email";
  return null;
}

/** SUPER_ADMIN_EMAILS ("a@b.uz, c@d.uz") → tozalangan ro'yxat; noto'g'rilari tashlab yuboriladi */
export function parseOwnerEmails(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out = raw
    .split(/[,;\s]+/)
    .map((e) => normalizeEmail(e))
    .filter((e): e is string => !!e);
  return [...new Set(out)];
}

export type LinkHash = { kind: "session"; accessToken: string; refreshToken: string } | { kind: "error"; code: string } | null;

/** Emaildagi havola qaytargan URL qismi: "#access_token=…&refresh_token=…&type=recovery" yoki "#error_code=otp_expired" */
export function parseLinkHash(hash: string): LinkHash {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const code = p.get("error_code") ?? p.get("error");
  if (code) return { kind: "error", code: /^[a-z0-9_]{1,64}$/i.test(code) ? code : "unknown" };
  const accessToken = p.get("access_token");
  const refreshToken = p.get("refresh_token");
  if (!accessToken || !refreshToken) return null;
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(accessToken) || accessToken.length > 4096 || refreshToken.length > 512) return null;
  return { kind: "session", accessToken, refreshToken };
}

/** Tiklash havolasi saytning boshqa sahifasiga tushdimi (Supabase'da qaytish manzili ruxsat ro'yxatida bo'lmasa — Site URL) */
export function isRecoveryHash(hash: string): boolean {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  return p.get("type") === "recovery" && !!p.get("access_token");
}

/** Kirgandan / koddan keyin qaytiladigan joy — faqat admin panel ichida, aks holda /admin */
export function adminNext(raw: string | null | undefined): string {
  const safe = safeInternalPath(raw, "/admin");
  return isAdminPath(safe.split("?")[0] ?? "") ? safe : "/admin";
}
