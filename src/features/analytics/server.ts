import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { cleanProps, isAnalyticsEvent } from "./events";

/** Server tomonida hodisa yozish (masalan e'lon joylandi). Xato asosiy ishni to'xtatmaydi. */
export async function trackServer(name: string, profileId: string | null, props?: Record<string, unknown>, anonId?: string | null): Promise<void> {
  if (!isAnalyticsEvent(name) || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    await createAdminClient()
      .from("analytics_events")
      .insert({ name, profile_id: profileId, anon_id: anonId && /^[A-Za-z0-9_-]{8,64}$/.test(anonId) ? anonId : null, props: cleanProps(props) });
  } catch {
    // hodisa ixtiyoriy
  }
}
