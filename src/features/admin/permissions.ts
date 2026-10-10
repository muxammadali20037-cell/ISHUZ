import type { Enums } from "@/types/database.types";

/**
 * Admin ruxsatlari — public.has_admin_permission(perm) SQL funksiyasining aynan nusxasi
 * (oxirgi ta'rif: supabase/migrations/0056_security_hardening.sql). SQL o'zgarsa bu fayl ham o'zgarishi shart.
 * Barcha admin huquqlari faqat ikki bosqichli kirish (aal2) bilan ishlaydi — buni SQL tekshiradi.
 *
 * Qoida: super_admin → hammasi; admin_users.permissions ichida bo'lsa → ha; aks holda rolga qarab.
 */
export type AdminRole = Enums<"admin_role">;

export const ADMIN_ROLES: readonly AdminRole[] = ["super_admin", "admin", "moderator", "support", "analyst"];

export const PERMISSIONS = [
  "users.view",
  "users.block",
  "users.contacts",
  "workers.view",
  "employers.view",
  "employers.verify",
  "vacancies.view",
  "vacancies.moderate",
  "categories.manage",
  "skills.manage",
  "regions.manage",
  "reports.view",
  "reports.resolve",
  "reviews.moderate",
  "chat.moderate",
  "notifications.broadcast",
  "analytics.view",
  "audit.view",
  "settings.manage",
  "admins.manage",
  "security.view",
  "security.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ADMIN_PERMS: readonly Permission[] = [
  "users.view",
  "users.block",
  "users.contacts",
  "workers.view",
  "employers.view",
  "employers.verify",
  "vacancies.view",
  "vacancies.moderate",
  "categories.manage",
  "skills.manage",
  "regions.manage",
  "reports.view",
  "reports.resolve",
  "reviews.moderate",
  "chat.moderate",
  "notifications.broadcast",
  "analytics.view",
  "audit.view",
  "security.view",
  "security.manage",
];

const MODERATOR_PERMS: readonly Permission[] = [
  "users.view",
  "workers.view",
  "employers.view",
  "vacancies.view",
  "vacancies.moderate",
  "reports.view",
  "reports.resolve",
  "reviews.moderate",
  "chat.moderate",
  "analytics.view",
];

const SUPPORT_PERMS: readonly Permission[] = ["users.view", "workers.view", "employers.view", "vacancies.view", "reports.view", "analytics.view"];

/** Tahlilchi: faqat agregat statistika (shaxsiy ma'lumotsiz) */
const ANALYST_PERMS: readonly Permission[] = ["analytics.view"];

const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  super_admin: PERMISSIONS,
  admin: ADMIN_PERMS,
  moderator: MODERATOR_PERMS,
  support: SUPPORT_PERMS,
  analyst: ANALYST_PERMS,
};

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

/**
 * has_admin_permission(perm) ning TS nusxasi.
 * @param role       admin_users.role (null → admin emas)
 * @param extra      admin_users.permissions (qo'shimcha ruxsatlar)
 * @param perm       tekshirilayotgan ruxsat
 * @param isActive   admin_users.is_active
 */
export function hasPermission(role: AdminRole | null | undefined, extra: readonly string[] | null | undefined, perm: Permission, isActive = true): boolean {
  if (!role || !isActive) return false;
  if (role === "super_admin") return true;
  if (extra?.includes(perm)) return true;
  return ROLE_PERMISSIONS[role].includes(perm);
}

/** Rol + qo'shimchalar asosida to'liq ruxsatlar ro'yxati (UI uchun) */
export function effectivePermissions(role: AdminRole | null | undefined, extra: readonly string[] | null | undefined, isActive = true): Permission[] {
  if (!role || !isActive) return [];
  return PERMISSIONS.filter((p) => hasPermission(role, extra, p, isActive));
}

/** Rolning o'zi beradigan ruxsatlar (qo'shimchalarsiz) */
export function rolePermissions(role: AdminRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
