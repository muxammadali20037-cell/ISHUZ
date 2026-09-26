import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";
import { publicEnv } from "@/lib/env";

/**
 * Server Component / Server Action / Route Handler uchun Supabase client.
 * Cookie'lar orqali foydalanuvchi sessiyasini o'qiydi (RLS foydalanuvchi nomidan ishlaydi).
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component ichida cookie yozib bo'lmaydi — proxy.ts sessiyani yangilab turadi
        }
      },
    },
  });
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Joriy foydalanuvchi (yo'q bo'lsa null). `getUser` serverda JWT ni tekshiradi. */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
