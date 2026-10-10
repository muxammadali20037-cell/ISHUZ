import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logSecurityEvent } from "./events";
import { crossedStep, type ActiveRestriction, type RestrictionScope, type RestrictionState, type SecurityRule } from "./rules";

/** Faol cheklov (DB). Xato bo'lsa — null (fail-open: asosiy himoya — atomik limitlar, ular fail-closed). */
export async function activeRestriction(scope: RestrictionScope, subject: string): Promise<ActiveRestriction | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const { data, error } = await createAdminClient().rpc("security_active_restriction", { p_scope: scope, p_subject: subject });
    if (error || !data || typeof data !== "object" || Array.isArray(data)) return null;
    const r = data as { state?: string; enforced?: boolean; expires_at?: string };
    if (!r.state || !r.expires_at) return null;
    return { state: r.state as RestrictionState, enforced: r.enforced === true, expiresAt: r.expires_at };
  } catch {
    return null;
  }
}

export interface RuleHitContext {
  subject: string;
  subjectHash: string;
  route: string;
  requestId: string | null;
  actorId?: string | null;
}

/**
 * Hisoblagich chegaraga yetganda: hodisa + cheklov (kuzatuv yoki majburiy — app_settings.security_restrictions_enforce).
 * Chegaradan oshgan har so'rovda takrorlanmaydi (crossedStep — aynan tenglikda).
 */
export async function applyRuleHit(rule: SecurityRule, count: number, ctx: RuleHitContext): Promise<void> {
  const step = crossedStep(rule, count);
  if (!step) return;
  const eventId = await logSecurityEvent({
    type: rule.id,
    severity: step.severity,
    reason: `threshold_${step.atCount}`,
    actorId: ctx.actorId ?? null,
    subjectHash: ctx.subjectHash,
    route: ctx.route,
    action: "restricted",
    requestId: ctx.requestId,
    ruleVersion: rule.version,
    details: { count, window_s: rule.windowSeconds, state: step.state },
  });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    await createAdminClient().rpc("security_restrict", {
      p_scope: rule.scope,
      p_subject: ctx.subject,
      p_state: step.state,
      p_reason_code: rule.id,
      p_ttl_seconds: step.ttlSeconds,
      p_rule_version: rule.version,
      p_event_id: eventId ?? undefined,
    });
  } catch {
    // jurnal yozildi; cheklov qo'yilmasa ham atomik limitlar ishlaydi
  }
}
