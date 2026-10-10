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

export type RateHit = { ok: true; count: number } | { ok: false; reason: "limited"; count: number } | { ok: false; reason: "unavailable" };

/**
 * Atomik hisoblagich (security_hit) — parallel so'rovlar limitni chetlab o'ta olmaydi.
 * Fail-closed: DB javob bermasa { ok: false, reason: "unavailable" } (chaqiruvchi 503 qaytaradi).
 * Kalitga telefon/IP ochiq qo'yilmaydi — subjectHash() ishlating.
 */
export async function hitRate(key: string, limit: number, windowSeconds: number): Promise<RateHit> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: true, count: 0 };
  try {
    const { data, error } = await createAdminClient().rpc("security_hit", { p_key: key, p_window_seconds: windowSeconds });
    if (error || typeof data !== "number") return { ok: false, reason: "unavailable" };
    return data <= limit ? { ok: true, count: data } : { ok: false, reason: "limited", count: data };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
