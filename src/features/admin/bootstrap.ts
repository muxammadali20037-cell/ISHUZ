import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";
import { logSecurityEvent } from "@/lib/security/events";
import { isOwnerPhone, parseOwnerPhones } from "./owner";

/**
 * Loyiha egasi: Vercel'dagi SUPER_ADMIN_PHONES ro'yxatidagi raqam bilan kirgan foydalanuvchi /admin ni ochganda
 * super_admin bo'ladi (SQL yozish shart emas) — faqat BIRINCHI marta (faol super_admin hali yo'q bo'lsa).
 * Raqam faqat Telegram orqali yuborilgan o'z kontakti bo'yicha (bot contact.user_id === from.id ni tekshiradi).
 * Faol super_admin bor bo'lsa — yangi hisob avtomatik ko'tarilmaydi (SIM almashtirish xavfi), adminlarga ogohlantirish.
 * O'chirilgan (is_active=false) admin avtomatik qayta yoqilmaydi. Bloklangan profil — yo'q. Har tayinlash auditga yoziladi.
 * Panelga kirish baribir ikki bosqichli (TOTP) bo'ladi.
 */
export async function ensureOwnerAdmin(userId: string): Promise<boolean> {
  const { SUPER_ADMIN_PHONES, SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  const owners = parseOwnerPhones(SUPER_ADMIN_PHONES);
  if (!owners.length || !SUPABASE_SERVICE_ROLE_KEY) return false;
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const [{ data: auth }, { data: tg }, { data: profile }, { data: existing }] = await Promise.all([
      supabase.auth.getUser(),
      admin.from("telegram_accounts").select("phone").eq("profile_id", userId).maybeSingle(),
      admin.from("profiles").select("is_blocked").eq("id", userId).maybeSingle(),
      admin.from("admin_users").select("role, is_active").eq("profile_id", userId).maybeSingle(),
    ]);
    if (!profile || profile.is_blocked || auth.user?.id !== userId) return false;
    if (existing?.is_active && existing.role === "super_admin") return true;
    if (existing && !existing.is_active) return false;
    if (!isOwnerPhone(owners, [tg?.phone ?? null])) return false;
    const { count: superAdmins } = await admin
      .from("admin_users")
      .select("profile_id", { count: "exact", head: true })
      .eq("role", "super_admin")
      .eq("is_active", true);
    if (superAdmins === null || superAdmins > 0) {
      await logSecurityEvent({ type: "admin.owner_bootstrap_denied", severity: "high", reason: "super_admin_exists", actorId: userId, route: "/admin", action: "blocked" });
      return false;
    }
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
