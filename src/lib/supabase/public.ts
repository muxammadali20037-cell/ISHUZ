import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { publicEnv } from "@/lib/env";

/**
 * Cookie'siz anon client — faqat OCHIQ ma'lumot uchun (ma'lumotnomalar, kasblar daraxti).
 * Foydalanuvchiga bog'liq emas, shuning uchun javoblar so'rovlar orasida keshlanadi (unstable_cache).
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Ma'lumotnoma keshi: 1 soat; admin o'zgartirsa — updateTag("reference") darhol yangilaydi */
export const REFERENCE_TAG = "reference";
export const REFERENCE_CACHE = { revalidate: 3600, tags: [REFERENCE_TAG] };
