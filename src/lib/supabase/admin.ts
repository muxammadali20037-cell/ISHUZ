import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { publicEnv, getServerEnv } from "@/lib/env";

/**
 * Service-role client: RLS ni chetlab o'tadi. FAQAT serverda, faqat zarur joyda
 * (Telegram auth, bot webhook, cron). Hech qachon client'ga bermang.
 */
export function createAdminClient() {
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY sozlanmagan");
  }
  return createSupabaseClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
