"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/format";
import { LOCALE_COOKIE, isLocale, type Locale } from "@/lib/i18n/config";
import { getSession } from "./session";

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
