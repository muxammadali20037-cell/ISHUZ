"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSecurityEvent } from "@/lib/security/events";
import type { ActionResult } from "@/features/auth/actions";
import { ADMIN_ACCOUNT_PATH, ADMIN_PASSWORD_MAX, normalizeEmail, passwordProblem } from "@/features/auth/admin-login";
import { getAdminActor } from "../context";
import { fail, logAdmin } from "./guard";

/**
 * Admin o'z hisobiga zaxira kirish (email + parol) o'rnatadi. Faqat ikki bosqichli kirishdan o'tgan (aal2) faol admin va
 * faqat O'Z hisobiga — boshqa adminning parolini hech kim qo'ya olmaydi. Parol qoidasi serverda tekshiriladi; parol
 * auditga yozilmaydi (faqat "o'rnatildi" belgisi). Telegram/telefon kirishi o'zgarmaydi: sessiya hisobning joriy emaili
 * orqali ochiladi, hisob esa telegram_accounts.profile_id bilan bog'langan.
 */
export async function setAdminLogin(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({ email: z.string().max(254), password: z.string().max(ADMIN_PASSWORD_MAX + 1), confirm: z.string().max(ADMIN_PASSWORD_MAX + 1) })
    .safeParse(input);
  if (!parsed.success) return fail("validation");
  const ctx = await getAdminActor();
  if (!ctx) return fail("not_authenticated");
  const email = normalizeEmail(parsed.data.email);
  if (!email) return fail("invalid_email");
  const problem = passwordProblem(parsed.data.password, email);
  if (problem) return fail(`password_${problem}`);
  if (parsed.data.password !== parsed.data.confirm) return fail("password_mismatch");

  const userId = ctx.session.userId;
  const admin = createAdminClient();
  const { data: before } = await admin.auth.admin.getUserById(userId);
  const { error } = await admin.auth.admin.updateUserById(userId, { email, password: parsed.data.password, email_confirm: true });
  if (error) {
    if (error.code === "email_exists" || /already|registered|exists/i.test(error.message)) return fail("email_taken");
    if (error.code === "weak_password") return fail("password_weak");
    console.error("[admin] set login", error.code ?? error.message);
    return fail("save_failed");
  }
  const supabase = await createClient();
  const emailChanged = (before.user?.email ?? "").toLowerCase() !== email;
  await logAdmin(supabase, "admin.login_credentials_set", "admin_user", userId, null, { method: "email_password", email_changed: emailChanged });
  await logSecurityEvent({ type: "admin.password_set", severity: "medium", reason: "self_service", actorId: userId, route: ADMIN_ACCOUNT_PATH, action: "logged", details: { email_changed: emailChanged } });
  revalidatePath(ADMIN_ACCOUNT_PATH);
  return { ok: true };
}
