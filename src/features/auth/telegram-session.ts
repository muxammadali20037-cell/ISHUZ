import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";

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

/**
 * Telegram hisobi uchun profilni topadi yoki yaratadi va telegram_accounts ni yangilaydi.
 * Qaytaradi: profile_id (= auth.users.id).
 */
export async function ensureTelegramProfile(admin: AdminClient, u: TelegramIdentity, locale?: "uz" | "ru" | "en"): Promise<string> {
  const { data: linked } = await admin.from("telegram_accounts").select("profile_id").eq("telegram_user_id", u.id).maybeSingle();
  let userId = linked?.profile_id ?? null;

  if (!userId) {
    const email = telegramEmail(u.id);
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        first_name: u.first_name ?? "",
        last_name: u.last_name ?? "",
        avatar_url: u.photo_url ?? null,
        locale: locale ?? (u.language_code === "ru" ? "ru" : "uz"),
        telegram_id: u.id,
      },
    });
    if (error) {
      if (!/already/i.test(error.message)) throw new Error(`createUser: ${error.message}`);
      userId = await findUserIdByEmail(admin, email);
      if (!userId) throw new Error("createUser: existing user not found");
    } else {
      userId = created.user.id;
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

  if (u.photo_url) {
    await admin.from("profiles").update({ avatar_url: u.photo_url }).eq("id", userId).is("avatar_url", null);
  }
  return userId;
}

async function findUserIdByEmail(admin: AdminClient, email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data.users.length) return null;
    const hit = data.users.find((x) => x.email === email);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

/**
 * Profil uchun sessiya ochadi (cookie'lar joriy javobga yoziladi): magic-link token_hash → verifyOtp.
 * Telefon orqali yaratilgan (email'siz) foydalanuvchiga texnik email biriktiriladi.
 */
export async function startSessionForProfile(admin: AdminClient, profileId: string, tgId: number): Promise<void> {
  const { data: got, error: getErr } = await admin.auth.admin.getUserById(profileId);
  if (getErr || !got.user) throw new Error(`getUserById: ${getErr?.message ?? "not found"}`);
  let email = got.user.email ?? null;
  if (!email) {
    email = telegramEmail(tgId);
    const { error } = await admin.auth.admin.updateUserById(profileId, { email, email_confirm: true });
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

function codeSecret(): string {
  const { SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN } = getServerEnv();
  const secret = SUPABASE_SERVICE_ROLE_KEY ?? TELEGRAM_BOT_TOKEN;
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
