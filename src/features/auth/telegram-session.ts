import type { Locale } from "@/lib/i18n/config";
import "server-only";

import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { logSecurityEvent } from "@/lib/security/events";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Telegram foydalanuvchisining minimal ma'lumoti (initData, webhook from, login widget) */
export interface TelegramIdentity {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export function telegramEmail(tgId: number) {
  return `tg_${tgId}@telegram.ishuz.local`;
}

/** Texnik manzil band bo'lsa (kimdir oldindan ro'yxatdan o'tgan) — tasodifiy qo'shimchali muqobil manzil */
function alternateTelegramEmail(tgId: number) {
  return `tg_${tgId}_${randomBytes(6).toString("hex")}@telegram.ishuz.local`;
}

/** Bloklangan hisobga kirish urinishlari (marshrutlar 403 "blocked" qaytaradi) */
export class AccountBlockedError extends Error {
  constructor() {
    super("account_blocked");
    this.name = "AccountBlockedError";
  }
}

interface TelegramAuthLookup {
  linked_profile_id: string | null;
  email_user_id: string | null;
  /** auth foydalanuvchini server yaratgan (app_metadata.tg_id — faqat service role yozadi) */
  email_trusted: boolean;
  blocked: boolean;
}

async function lookupTelegramAuth(admin: AdminClient, tgId: number): Promise<TelegramAuthLookup | null> {
  const { data, error } = await admin.rpc("telegram_auth_lookup", { p_telegram_user_id: tgId });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return null;
  return data as unknown as TelegramAuthLookup;
}

/**
 * Telegram hisobi uchun profilni topadi yoki yaratadi va telegram_accounts ni yangilaydi.
 * Qaytaradi: profile_id (= auth.users.id).
 *
 * Hisobni egallashdan himoya: tg_<id>@telegram.ishuz.local manzili oldindan (ochiq ro'yxatdan o'tish orqali, o'z paroli bilan)
 * band qilingan bo'lsa — o'sha hisob QABUL QILINMAYDI. Faqat server yaratgan (app_metadata.tg_id mos) hisob qabul qilinadi;
 * aks holda muqobil manzil bilan yangi hisob yaratiladi va adminlarga ogohlantirish yuboriladi.
 */
export async function ensureTelegramProfile(admin: AdminClient, u: TelegramIdentity, locale?: Locale): Promise<string> {
  const { data: linked } = await admin.from("telegram_accounts").select("profile_id").eq("telegram_user_id", u.id).maybeSingle();
  let userId = linked?.profile_id ?? null;

  if (!userId) {
    const lookup = await lookupTelegramAuth(admin, u.id);
    if (lookup?.email_user_id && lookup.email_trusted) {
      // oldingi urinishda server yaratgan, lekin telegram_accounts yozilmay qolgan hisob
      userId = lookup.email_user_id;
    } else {
      const preclaimed = !!lookup?.email_user_id;
      if (preclaimed) {
        await logSecurityEvent({ type: "auth.telegram_email_preclaimed", severity: "high", reason: "untrusted_existing_user", route: "/api/auth/telegram", action: "blocked" });
      }
      userId = await createTelegramAuthUser(admin, u, locale, preclaimed ? alternateTelegramEmail(u.id) : telegramEmail(u.id));
    }
  }

  const { error: upErr } = await admin.from("telegram_accounts").upsert(
    {
      telegram_user_id: u.id,
      profile_id: userId,
      username: u.username ?? null,
      first_name: u.first_name ?? null,
      last_name: u.last_name ?? null,
      ...(u.photo_url ? { photo_url: u.photo_url } : {}),
      ...(u.language_code ? { language_code: u.language_code } : {}),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "telegram_user_id" },
  );
  if (upErr) throw new Error(`telegram_accounts upsert: ${upErr.message}`);

  // DB triggeri faqat Telegram userpic / o'z storage manzilini qabul qiladi (boshqasi — e'tiborsiz)
  if (u.photo_url) {
    await admin.from("profiles").update({ avatar_url: u.photo_url }).eq("id", userId).is("avatar_url", null);
  }
  return userId;
}

async function createTelegramAuthUser(admin: AdminClient, u: TelegramIdentity, locale: Locale | undefined, email: string): Promise<string> {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { tg_id: u.id },
    user_metadata: {
      first_name: u.first_name ?? "",
      last_name: u.last_name ?? "",
      avatar_url: u.photo_url ?? null,
      locale: locale ?? (u.language_code === "ru" ? "ru" : "uz"),
      telegram_id: u.id,
    },
  });
  if (!error) return created.user.id;
  if (!/already/i.test(error.message)) throw new Error(`createUser: ${error.message}`);
  // parallel kirish: boshqa so'rov hozirgina yaratgan bo'lishi mumkin — faqat ishonchli (tg_id) bo'lsa qabul qilinadi
  const again = await lookupTelegramAuth(admin, u.id);
  if (again?.email_user_id && again.email_trusted) return again.email_user_id;
  throw new Error("createUser: email conflict");
}

/**
 * Profil uchun sessiya ochadi (cookie'lar joriy javobga yoziladi): magic-link token_hash → verifyOtp.
 * Telefon orqali yaratilgan (email'siz) foydalanuvchiga texnik email biriktiriladi.
 */
export async function startSessionForProfile(admin: AdminClient, profileId: string, tgId: number): Promise<void> {
  const [{ data: got, error: getErr }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(profileId),
    admin.from("profiles").select("is_blocked").eq("id", profileId).maybeSingle(),
  ]);
  if (getErr || !got.user) throw new Error(`getUserById: ${getErr?.message ?? "not found"}`);
  const bannedUntil = got.user.banned_until ? new Date(got.user.banned_until).getTime() : 0;
  if (profile?.is_blocked || bannedUntil > Date.now()) throw new AccountBlockedError();
  let email = got.user.email ?? null;
  if (!email) {
    email = telegramEmail(tgId);
    let { error } = await admin.auth.admin.updateUserById(profileId, { email, email_confirm: true, app_metadata: { tg_id: tgId } });
    if (error && /already/i.test(error.message)) {
      // texnik manzil boshqa (ehtimol oldindan band qilingan) hisobda — muqobil manzil
      email = alternateTelegramEmail(tgId);
      ({ error } = await admin.auth.admin.updateUserById(profileId, { email, email_confirm: true, app_metadata: { tg_id: tgId } }));
    }
    if (error) throw new Error(`updateUserById: ${error.message}`);
  }
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkErr || !link.properties?.hashed_token) throw new Error(`generateLink: ${linkErr?.message ?? "no token"}`);
  const supabase = await createClient();
  const { error: verifyErr } = await supabase.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  if (verifyErr) throw new Error(`verifyOtp: ${verifyErr.message}`);
}

/** Telegram kontaktidagi raqam → E.164 ("998901234567" | "+998 90..." → "+998901234567") */
export function normalizeContactPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

// ---------- bir martalik kirish kodlari ----------

export const LOGIN_CODE_TTL_SECONDS = 5 * 60;
export const LOGIN_CODE_RESEND_SECONDS = 60;
export const LOGIN_CODE_MAX_ATTEMPTS = 5;

export function generateLoginCode(): string {
  return String(randomInt(100000, 1000000));
}

/** Kod xeshi kaliti: alohida LOGIN_CODE_SECRET (tavsiya) → service kaliti → bot tokeni */
function codeSecret(): string {
  const { SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN } = getServerEnv();
  const secret = process.env.LOGIN_CODE_SECRET || SUPABASE_SERVICE_ROLE_KEY || TELEGRAM_BOT_TOKEN;
  if (!secret) throw new Error("login code secret missing");
  return secret;
}

export function hashLoginCode(phone: string, code: string, secret = codeSecret()): string {
  return createHmac("sha256", secret).update(`login:${phone}:${code}`).digest("hex");
}

export function loginCodeMatches(phone: string, code: string, expectedHash: string, secret = codeSecret()): boolean {
  const a = Buffer.from(hashLoginCode(phone, code, secret), "hex");
  const b = Buffer.from(expectedHash, "hex");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}
