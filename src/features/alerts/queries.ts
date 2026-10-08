import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SessionContext } from "@/features/auth/session";
import type { AlertRole, AlertSubscription } from "./types";

export async function getAlertSubscriptions(session: SessionContext): Promise<{ subs: Record<AlertRole, AlertSubscription>; telegramLinked: boolean }> {
  const supabase = await createClient();
  const [{ data: rows }, { data: tg }] = await Promise.all([
    supabase.from("match_subscriptions").select("*").eq("profile_id", session.userId),
    supabase.from("telegram_accounts").select("bot_started").eq("profile_id", session.userId).maybeSingle(),
  ]);
  const make = (role: AlertRole): AlertSubscription => {
    const r = (rows ?? []).find((x) => x.role === role);
    return {
      role,
      enabled: !!r?.enabled,
      status: !r?.enabled ? "off" : r.telegram_confirmed_at && tg?.bot_started ? "active" : "needs_bot",
      mode: r?.mode === "digest" ? "digest" : "instant",
      professionNodeId: r?.profession_node_id ?? null,
      regionId: r?.region_id ?? null,
      salaryMin: r?.salary_min ?? null,
      schedules: r?.schedules ?? [],
      vacancyIds: r?.vacancy_ids ?? [],
      pausedReason: r?.paused_reason ?? null,
    };
  };
  return { subs: { worker: make("worker"), employer: make("employer") }, telegramLinked: !!tg };
}
