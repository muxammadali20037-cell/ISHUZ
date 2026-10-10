import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";
import { isOwnerPhone, parseOwnerPhones } from "./owner";

/**
 * Loyiha egasi: Vercel'dagi SUPER_ADMIN_PHONES ro'yxatidagi raqam bilan kirgan foydalanuvchi /admin ni ochganda
 * super_admin bo'ladi (SQL yozish shart emas). Faqat TASDIQLANGAN raqam hisobga olinadi: SMS-kod bilan kirish
 * (auth phone_confirmed_at), Telegram orqali yuborilgan o'z kontakti yoki profildagi tasdiqlangan raqam.
 * Bloklangan profil — yo'q. Har tayinlash auditga yoziladi. Panelga kirish baribir ikki bosqichli (TOTP) bo'ladi.
 */
export async function ensureOwnerAdmin(userId: string): Promise<boolean> {
  const { SUPER_ADMIN_PHONES, SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  const owners = parseOwnerPhones(SUPER_ADMIN_PHONES);
  if (!owners.length || !SUPABASE_SERVICE_ROLE_KEY) return false;
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const [{ data: auth }, { data: contact }, { data: tg }, { data: profile }, { data: existing }] = await Promise.all([
      supabase.auth.getUser(),
      admin.from("profile_contacts").select("phone, phone_verified_at").eq("profile_id", userId).maybeSingle(),
      admin.from("telegram_accounts").select("phone").eq("profile_id", userId).maybeSingle(),
      admin.from("profiles").select("is_blocked").eq("id", userId).maybeSingle(),
      admin.from("admin_users").select("role, is_active").eq("profile_id", userId).maybeSingle(),
    ]);
    if (!profile || profile.is_blocked || auth.user?.id !== userId) return false;
    if (existing?.is_active && existing.role === "super_admin") return true;
    const verified = [
      auth.user.phone_confirmed_at ? auth.user.phone : null,
      contact?.phone_verified_at ? contact.phone : null,
      tg?.phone ?? null,
    ];
    if (!isOwnerPhone(owners, verified)) return false;
    const { error } = await admin
      .from("admin_users")
      .upsert({ profile_id: userId, role: "super_admin", is_active: true, permissions: [] }, { onConflict: "profile_id" });
    if (error) {
      console.error("[admin] owner bootstrap", error.message);
      return false;
    }
    await admin.from("audit_logs").insert({
      actor_id: userId,
      action: "admin.owner_bootstrap",
      target_type: "admin_user",
      target_id: userId,
      before_data: existing ? { role: existing.role, is_active: existing.is_active } : null,
      after_data: { role: "super_admin", is_active: true, source: "SUPER_ADMIN_PHONES" },
    });
    return true;
  } catch (e) {
    console.error("[admin] owner bootstrap", e instanceof Error ? e.message : e);
    return false;
  }
}
