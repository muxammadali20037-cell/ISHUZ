import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server tomonidagi limit (check_rate_limit, service role). Service kaliti bo'lmasa (lokal ishlab chiqish) — ruxsat.
 * Masalan: allowRate(`publish:${userId}`, 20, 3600) — soatiga 20 marta.
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
