"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";
import { publicEnv } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Brauzer uchun yagona Supabase client (singleton). */
export function createClient() {
  if (!client) {
    client = createBrowserClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  }
  return client;
}

export type SupabaseBrowserClient = ReturnType<typeof createClient>;
