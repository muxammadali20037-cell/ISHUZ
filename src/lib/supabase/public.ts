import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { publicEnv } from "@/lib/env";
import type { SupabaseServerClient } from "./server";

/**
 * Cookie'siz anon client — faqat OCHIQ ma'lumot uchun (ma'lumotnomalar, kasblar daraxti).
 * Foydalanuvchiga bog'liq emas, shuning uchun javoblar so'rovlar orasida keshlanadi (unstable_cache).
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * O'qish mijozi: cookie'li (foydalanuvchi nomidan) yoki cookie'siz public. Keshlanadigan OCHIQ ro'yxatlar (bosh sahifa
 * ro'yxati, o'xshash vakansiyalar) unstable_cache ichida cookies() chaqira olmaydi — ularga public client beriladi.
 */
export type ReadClient = SupabaseServerClient | ReturnType<typeof createPublicClient>;

/**
 * Ochiq ro'yxatlar keshi tegi (bosh sahifadagi "Yangi e'lonlar / Yangi ishchilar", "O'xshash vakansiyalar"): 60 s;
 * e'lon joylansa, yopilsa yoki holati o'zgarsa — updateTag(PUBLIC_FEED_TAG) darhol yangilaydi (post/actions, vacancies/actions).
 */
export const PUBLIC_FEED_TAG = "public-feed";

/** Ma'lumotnoma keshi: 1 soat; admin o'zgartirsa — updateTag("reference") darhol yangilaydi */
export const REFERENCE_TAG = "reference";
export const REFERENCE_CACHE = { revalidate: 3600, tags: [REFERENCE_TAG] };
