"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prefCookie } from "@/lib/security/cookies";
import { safeInternalPath } from "@/lib/security/safe-path";
import { getSession } from "@/features/auth/session";
import type { ActionResult } from "@/features/auth/actions";
import { MODE_COOKIE } from "./mode";

const modeSchema = z.enum(["worker", "employer"]);

/**
 * "Ish izlovchi" yoki "Ish beruvchi" rejimini tanlash (foydalanuvchi tasdiqlagandan keyin). Qurilmadagi cookie va
 * (kirgan bo'lsa) profiles.active_role bitta joyda yoziladi — ikkalasi doim bir xil.
 */
export async function chooseMode(input: unknown): Promise<ActionResult> {
  const parsed = modeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const mode = parsed.data;
  const jar = await cookies();
  jar.set(MODE_COOKIE, mode, prefCookie(60 * 60 * 24 * 365));
  const session = await getSession();
  if (session && !session.profile.is_blocked && session.profile.active_role !== mode) {
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update({ active_role: mode }).eq("id", session.userId);
    if (error) return { ok: false, error: "generic" };
  }
  return { ok: true };
}

/**
 * Kirish oynasidagi maqsad plitkasi ("Ish topaman", "Ishchi topaman", "Kunlik ish"...): JS'siz ham ishlaydigan forma.
 * Rejim yoziladi va o'sha bo'limga o'tiladi; `next` — faqat ilova ichidagi manzil (tashqi yo'naltirish yo'q).
 */
export async function enterMode(form: FormData): Promise<void> {
  const mode = modeSchema.safeParse(form.get("mode"));
  const next = form.get("next");
  if (mode.success) await chooseMode(mode.data);
  redirect(safeInternalPath(typeof next === "string" ? next : null));
}
