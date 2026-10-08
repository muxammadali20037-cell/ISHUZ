import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession, requireSession, type SessionContext } from "@/features/auth/session";
import { hasPermission, type AdminRole, type Permission } from "./permissions";

export interface AdminContext {
  session: SessionContext;
  role: AdminRole;
  permissions: string[];
  /** has_admin_permission(perm) ning server nusxasi */
  can: (perm: Permission) => boolean;
}

async function loadAdminRow(userId: string) {
  const supabase = await createClient();
  const [{ data }, { data: status }] = await Promise.all([
    supabase.from("admin_users").select("role, permissions, is_active").eq("profile_id", userId).maybeSingle(),
    supabase.rpc("my_admin_status"),
  ]);
  if (!data) return null;
  // ikki bosqichli kirish (TOTP, aal2) — bazadagi admin_aal_ok() bilan bir xil qoida
  const aalOk = !!(status as { aal_ok?: boolean } | null)?.aal_ok;
  return { ...data, aalOk };
}

function build(session: SessionContext, row: { role: AdminRole; permissions: string[] }): AdminContext {
  return {
    session,
    role: row.role,
    permissions: row.permissions,
    can: (perm) => hasPermission(row.role, row.permissions, perm),
  };
}

/**
 * Sahifalar uchun: kirmagan bo'lsa — kirish sahifasi; admin bo'lmasa — 404 (panel borligi bildirilmaydi,
 * alohida admin hostda "/" ga yo'naltirish aylanib qolmaydi); MFA yo'q bo'lsa — /admin/mfa. Bir so'rovda keshlanadi.
 */
export const getAdminContext = cache(async (): Promise<AdminContext> => {
  const session = await requireSession("/admin");
  if (!session.isAdmin || session.profile.is_blocked) notFound();
  const row = await loadAdminRow(session.userId);
  if (!row?.is_active) notFound();
  if (!row.aalOk) redirect("/admin/mfa");
  return build(session, row);
});

/** Server action'lar uchun: redirect qilmaydi, admin bo'lmasa null. */
export const getAdminActor = cache(async (): Promise<AdminContext | null> => {
  const session = await getSession();
  if (!session || !session.isAdmin || session.profile.is_blocked) return null;
  const row = await loadAdminRow(session.userId);
  if (!row?.is_active || !row.aalOk) return null;
  return build(session, row);
});
