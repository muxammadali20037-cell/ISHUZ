import { normalizePhone } from "@/lib/format";

/**
 * SUPER_ADMIN_PHONES ("+998 90 123 45 67, 998911234567") → E.164 ro'yxati.
 * Noto'g'ri yozilganlar tashlab yuboriladi.
 */
export function parseOwnerPhones(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out = raw
    .split(/[,;\n]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => normalizePhone(p))
    .filter((p): p is string => !!p);
  return [...new Set(out)];
}

/** Foydalanuvchining tasdiqlangan raqamlaridan biri egalar ro'yxatidami */
export function isOwnerPhone(owners: string[], verifiedPhones: Array<string | null | undefined>): boolean {
  if (!owners.length) return false;
  return verifiedPhones.some((p) => {
    const n = p ? normalizePhone(p) : null;
    return !!n && owners.includes(n);
  });
}
