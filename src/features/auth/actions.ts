"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/format";
import { LOCALE_COOKIE, isLocale, type Locale } from "@/lib/i18n/config";
import { getSession } from "./session";
import { GREETING_NAME_COOKIE } from "@/components/shared/welcome-cookie";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/** Telefon raqamga OTP yuborish (Supabase Auth → SMS provayder) */
export async function sendPhoneOtp(input: { phone: string; locale?: string }): Promise<ActionResult<{ phone: string }>> {
  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, error: "invalid_phone" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { data: { locale: isLocale(input.locale) ? input.locale : "uz" } },
  });
  if (error) {
    console.error("[auth] sendPhoneOtp", error.message);
    return { ok: false, error: /rate/i.test(error.message) ? "rate_limited" : "otp_send_failed" };
  }
  return { ok: true, data: { phone } };
}

/** OTP kodni tekshirish → sessiya cookie'lari o'rnatiladi */
export async function verifyPhoneOtp(input: { phone: string; token: string }): Promise<ActionResult> {
  const parsed = z.object({ phone: z.string(), token: z.string().regex(/^\d{4,8}$/) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_code" };
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return { ok: false, error: "invalid_phone" };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ phone, token: parsed.data.token, type: "sms" });
  if (error) {
    console.error("[auth] verifyPhoneOtp", error.message);
    return { ok: false, error: /expired/i.test(error.message) ? "code_expired" : "invalid_code" };
  }
  return { ok: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/** Tilni saqlash: cookie + profil */
export async function setLocale(locale: Locale) {
  if (!isLocale(locale)) return;
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const session = await getSession();
  if (session) {
    const supabase = await createClient();
    await supabase.from("profiles").update({ locale }).eq("id", session.userId);
  }
}

/**
 * Kirish oynasidagi ism: cookie'ga yoziladi (hali kirmagan bo'lsa ham), kirgan bo'lsa va profilda ism bo'lmasa — profilga.
 */
export async function saveGreetingName(raw: string): Promise<ActionResult> {
  const name = z.string().trim().min(2).max(60).safeParse(raw);
  if (!name.success) return { ok: false, error: "validation" };
  const cookieStore = await cookies();
  cookieStore.set(GREETING_NAME_COOKIE, encodeURIComponent(name.data), { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" });
  const session = await getSession();
  if (session && !session.profile.first_name.trim()) {
    const supabase = await createClient();
    await supabase.from("profiles").update({ first_name: name.data }).eq("id", session.userId);
  }
  return { ok: true };
}

/** Faol rolni almashtirish (worker ↔ employer) */
export async function setActiveRole(role: "worker" | "employer"): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ active_role: role }).eq("id", session.userId);
  if (error) return { ok: false, error: "generic" };
  return { ok: true };
}

/** Faollik belgisi (last_seen_at) */
export async function touchLastSeen() {
  const session = await getSession();
  if (!session) return;
  const supabase = await createClient();
  await supabase.rpc("touch_last_seen");
}
