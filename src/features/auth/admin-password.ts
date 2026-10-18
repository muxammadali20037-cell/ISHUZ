import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv, publicEnv } from "@/lib/env";
import { logSecurityEvent } from "@/lib/security/events";
import { isOwnerPhone, parseOwnerPhones } from "@/features/admin/owner";
import { ADMIN_LINK_PATH, isTechnicalEmail, parseOwnerEmails } from "./admin-login";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Adminlar soni kichik — har birining auth manzili o'qiladi (Auth API'da email bo'yicha qidiruv yo'q) */
const MAX_ADMINS_SCANNED = 200;

/** Shu email biriktirilgan faol, bloklanmagan admin (bo'lmasa — null) */
export async function findActiveAdminByEmail(admin: AdminClient, email: string): Promise<string | null> {
  const { data: rows, error } = await admin.from("admin_users").select("profile_id").eq("is_active", true).limit(MAX_ADMINS_SCANNED);
  if (error) throw new Error(`admin_users: ${error.code}`);
  const ids = (rows ?? []).map((r) => r.profile_id);
  const users = await Promise.all(ids.map((id) => admin.auth.admin.getUserById(id).then((r) => r.data.user ?? null)));
  const match = users.find((u) => u?.email?.toLowerCase() === email);
  if (!match) return null;
  const { data: profile } = await admin.from("profiles").select("is_blocked").eq("id", match.id).maybeSingle();
  return profile && !profile.is_blocked ? match.id : null;
}

/**
 * Loyiha egasi Telegram'siz birinchi marta: Vercel'dagi SUPER_ADMIN_EMAILS ro'yxatidagi email egasining hisobiga
 * biriktiriladi (keyin unga parol o'rnatish havolasi yuboriladi). Egasi — yagona faol super_admin; bir nechta bo'lsa —
 * tasdiqlangan raqami SUPER_ADMIN_PHONES da bo'lgani (aniq bittasi). Hisobda allaqachon haqiqiy (texnik emas) email
 * bo'lsa — almashtirilmaydi. Har biriktirish auditga va xavfsizlik jurnaliga yoziladi (adminlarga ogohlantirish).
 * Vercel env'ni boshqara oladigan odam baribir hamma narsani boshqaradi — bu yangi huquq bermaydi; panelga kirish
 * uchun autentifikator kodi (TOTP) baribir kerak.
 */
export async function attachOwnerEmail(admin: AdminClient, email: string, requestId: string | null): Promise<string | null> {
  const { SUPER_ADMIN_EMAILS, SUPER_ADMIN_PHONES } = getServerEnv();
  if (!parseOwnerEmails(SUPER_ADMIN_EMAILS).includes(email)) return null;
  const route = "/api/auth/admin/recover";
  const { data: supers, error } = await admin.from("admin_users").select("profile_id").eq("role", "super_admin").eq("is_active", true).limit(20);
  if (error) throw new Error(`admin_users: ${error.code}`);
  let ids = (supers ?? []).map((r) => r.profile_id);
  if (ids.length > 1) {
    const owners = parseOwnerPhones(SUPER_ADMIN_PHONES);
    const checks = await Promise.all(
      ids.map(async (id) => {
        const [{ data: contact }, { data: tg }] = await Promise.all([
          admin.from("profile_contacts").select("phone, phone_verified_at").eq("profile_id", id).maybeSingle(),
          admin.from("telegram_accounts").select("phone").eq("profile_id", id).maybeSingle(),
        ]);
        return isOwnerPhone(owners, [contact?.phone_verified_at ? contact.phone : null, tg?.phone ?? null]) ? id : null;
      }),
    );
    ids = checks.filter((id): id is string => !!id);
  }
  if (ids.length !== 1) {
    await logSecurityEvent({ type: "admin.owner_email_ambiguous", severity: "medium", reason: ids.length ? "several_owners" : "no_owner", route, action: "blocked", requestId });
    return null;
  }
  const ownerId = ids[0]!;
  const [{ data: got }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(ownerId),
    admin.from("profiles").select("is_blocked").eq("id", ownerId).maybeSingle(),
  ]);
  if (!got.user || !profile || profile.is_blocked) return null;
  if (got.user.email?.toLowerCase() === email) return ownerId;
  if (!isTechnicalEmail(got.user.email)) {
    await logSecurityEvent({ type: "admin.owner_email_conflict", severity: "medium", reason: "real_email_exists", actorId: ownerId, route, action: "blocked", requestId });
    return null;
  }
  const { error: upErr } = await admin.auth.admin.updateUserById(ownerId, { email, email_confirm: true });
  if (upErr) {
    await logSecurityEvent({ type: "admin.owner_email_attach_failed", severity: "medium", reason: /already|exists|registered/i.test(upErr.message) ? "email_taken" : "update_failed", actorId: ownerId, route, action: "blocked", requestId });
    return null;
  }
  await admin.from("audit_logs").insert({
    actor_id: ownerId,
    action: "admin.owner_email_attach",
    target_type: "admin_user",
    target_id: ownerId,
    after_data: { source: "SUPER_ADMIN_EMAILS" },
  });
  await logSecurityEvent({ type: "admin.owner_email_attached", severity: "high", reason: "super_admin_emails", actorId: ownerId, route, action: "logged", requestId });
  return ownerId;
}

/** Havolalar qaytadigan manzil: alohida admin domeni bo'lsa — o'sha, aks holda asosiy sayt */
export function adminBaseUrl(): string {
  const { ADMIN_HOST, APP_URL } = getServerEnv();
  return ADMIN_HOST ? `https://${ADMIN_HOST.replace(/^https?:\/\//, "").replace(/\/+$/, "")}` : APP_URL.replace(/\/+$/, "");
}

/**
 * Parol o'rnatish havolasini Supabase emaili orqali yuboradi. "implicit" oqim: havola tokenlarni URL qismida (#) qaytaradi —
 * xat boshqa qurilmada ochilsa ham ishlaydi (PKCE kodi esa so'ragan brauzerga bog'lanib qolardi).
 */
export async function sendAdminLink(email: string): Promise<{ ok: true } | { ok: false; code: string }> {
  const anon = createSupabaseClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await anon.auth.resetPasswordForEmail(email, { redirectTo: `${adminBaseUrl()}${ADMIN_LINK_PATH}` });
  return error ? { ok: false, code: error.code ?? "send_failed" } : { ok: true };
}
