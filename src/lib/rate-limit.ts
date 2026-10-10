import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server tomonidagi limit (check_rate_limit, service role). Service kaliti bo'lmasa (lokal ishlab chiqish) — ruxsat.
 * Masalan: allowRate(`publish:${userId}`, 20, 3600) — soatiga 20 marta.
 * Fail-open: oddiy funksiyalar uchun (DB vaqtincha ishlamasa foydalanuvchi to'xtab qolmasin).
 * Xavfsizlik (kirish, kod, xarajat) uchun — hitRate (fail-closed).
 */
export async function allowRate(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return true;
  try {
    const { data, error } = await createAdminClient().rpc("check_rate_limit", { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}

/** count: hisoblagich qiymati; -1 — noma'lum (eski limit funksiyasi) */
export type RateHit = { ok: true; count: number } | { ok: false; reason: "limited"; count: number } | { ok: false; reason: "unavailable" };

/**
 * Atomik hisoblagich (security_hit) — parallel so'rovlar limitni chetlab o'ta olmaydi.
 * Fail-closed: DB javob bermasa { ok: false, reason: "unavailable" } (chaqiruvchi 503 qaytaradi).
 * Kalitga telefon/IP ochiq qo'yilmaydi — subjectHash() ishlating.
 */
export async function hitRate(key: string, limit: number, windowSeconds: number): Promise<RateHit> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: true, count: 0 };
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("security_hit", { p_key: key, p_window_seconds: windowSeconds });
    if (error && isMissingFunction(error)) {
      // 0056 hali qo'llanmagan baza (deploy oynasi): eski atomik limit — chegara ishlaydi, soni noma'lum (-1)
      const old = await admin.rpc("check_rate_limit", { p_key: key, p_limit: Math.min(limit, 2_000_000_000), p_window_seconds: windowSeconds });
      if (old.error || typeof old.data !== "boolean") return { ok: false, reason: "unavailable" };
      return old.data ? { ok: true, count: -1 } : { ok: false, reason: "limited", count: limit + 1 };
    }
    if (error || typeof data !== "number") return { ok: false, reason: "unavailable" };
    return data <= limit ? { ok: true, count: data } : { ok: false, reason: "limited", count: data };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/** PostgREST: funksiya topilmadi (PGRST202) yoki Postgres 42883 */
function isMissingFunction(error: { code?: string }): boolean {
  return error.code === "PGRST202" || error.code === "42883";
}
