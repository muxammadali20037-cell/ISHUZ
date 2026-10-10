"use server";

import { cookies } from "next/headers";
import { prefCookie } from "@/lib/security/cookies";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE, isLocale, type Locale } from "@/lib/i18n/config";
import { getSession } from "./session";
import { GREETING_NAME_COOKIE } from "@/components/shared/welcome-cookie";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/** Tilni saqlash: cookie + profil */
export async function setLocale(locale: Locale) {
  if (!isLocale(locale)) return;
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, prefCookie(60 * 60 * 24 * 365));
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
  cookieStore.set(GREETING_NAME_COOKIE, encodeURIComponent(name.data), prefCookie(60 * 60 * 24 * 30));
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
