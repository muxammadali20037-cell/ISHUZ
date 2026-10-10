import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type SecuritySeverity = "info" | "low" | "medium" | "high" | "critical";
export type SecurityAction = "logged" | "observed" | "throttled" | "challenged" | "restricted" | "blocked" | "sessions_revoked" | "lifted";

export interface SecurityEventInput {
  /** a-z0-9_. — masalan "auth.otp_bruteforce" */
  type: string;
  severity: SecuritySeverity;
  /** qoida sababi (a-z0-9_.) */
  reason: string;
  actorId?: string | null;
  /** subjectHash() natijasi — telefon/IP ochiq yozilmaydi */
  subjectHash?: string | null;
  route?: string | null;
  action?: SecurityAction;
  requestId?: string | null;
  ruleVersion?: string | null;
  /** faqat texnik qiymatlar (son, kod) — shaxsiy ma'lumot yo'q */
  details?: Record<string, string | number | boolean | null>;
}

/** Vercel so'rov identifikatori (log va hodisalarni bog'lash uchun); format tekshiriladi */
export function requestIdOf(headers: Headers): string | null {
  const v = headers.get("x-vercel-id") ?? headers.get("x-request-id");
  return v && /^[A-Za-z0-9:._-]{1,100}$/.test(v) ? v : null;
}

/**
 * Xavfsizlik hodisasini yozadi (security_events, append-only). Yuqori/kritik — adminlarga ogohlantirish (DB, dedupe).
 * Hech qachon xato tashlamaydi: jurnal ishlamasa asosiy oqim to'xtamasin (hodisa baribir server logiga tushadi).
 */
export async function logSecurityEvent(e: SecurityEventInput): Promise<string | null> {
  // strukturali log: faqat kodlar, PII yo'q
  console.warn(
    JSON.stringify({ sec: e.type, severity: e.severity, reason: e.reason, action: e.action ?? "logged", route: e.route ?? null, request_id: e.requestId ?? null }),
  );
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const { data, error } = await createAdminClient().rpc("security_log_event", {
      p_event_type: e.type,
      p_severity: e.severity,
      p_reason_code: e.reason,
      p_actor_id: e.actorId ?? undefined,
      p_subject_hash: e.subjectHash ?? undefined,
      p_route: e.route ?? undefined,
      p_action_taken: e.action ?? "logged",
      p_request_id: e.requestId ?? undefined,
      p_rule_version: e.ruleVersion ?? undefined,
      p_details: e.details ?? {},
    });
    if (error) {
      console.error("[security] log_event", error.code);
      return null;
    }
    return data ?? null;
  } catch {
    return null;
  }
}
