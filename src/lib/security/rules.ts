/**
 * Cheklov qoidalari (sof — testlanadi). Holat mashinasi:
 *   NORMAL → THROTTLED → CHALLENGE_REQUIRED → TEMPORARILY_RESTRICTED  (+ COMPROMISE_SUSPECTED — alohida, faqat hisob)
 * Har qoida: doira (scope), chegaralar, muddat (doim cheklangan), versiya. Muddatlar DB'da ham qisqartiriladi
 * (telefon/IP/telegram ≤ 1 soat, hisob ≤ 7 kun) — begona odam jabrlanuvchini doimiy bloklay olmaydi.
 * Qaror faqat serverda; AI yagona qaror qiluvchi emas.
 */
import type { SecuritySeverity } from "./events";

export type RestrictionScope = "account" | "phone" | "ip" | "telegram";
export type RestrictionState = "throttled" | "challenge_required" | "temporarily_restricted" | "compromise_suspected";

export interface RuleStep {
  /** shu sondan boshlab (oyna ichida) */
  atCount: number;
  state: RestrictionState;
  ttlSeconds: number;
  severity: SecuritySeverity;
}

export interface SecurityRule {
  id: string;
  version: string;
  scope: RestrictionScope;
  windowSeconds: number;
  /** o'sish tartibida */
  steps: readonly RuleStep[];
}

export const RULES = {
  /** bitta telefon uchun noto'g'ri kodlar (kim yuborganidan qat'i nazar) */
  otpVerifyFailuresPerPhone: {
    id: "auth.otp_verify_failures_phone",
    version: "otp-v1",
    scope: "phone",
    windowSeconds: 3600,
    steps: [
      { atCount: 10, state: "challenge_required", ttlSeconds: 15 * 60, severity: "medium" },
      { atCount: 20, state: "temporarily_restricted", ttlSeconds: 30 * 60, severity: "high" },
    ],
  },
  /** bitta IP (/64) dan noto'g'ri kodlar — ko'p telefonni sinash */
  otpVerifyFailuresPerIp: {
    id: "auth.otp_verify_failures_ip",
    version: "otp-v1",
    scope: "ip",
    windowSeconds: 3600,
    steps: [
      { atCount: 20, state: "throttled", ttlSeconds: 15 * 60, severity: "medium" },
      { atCount: 50, state: "temporarily_restricted", ttlSeconds: 60 * 60, severity: "high" },
    ],
  },
  /** bitta IP dan kod so'rovlari (bot orqali spam) */
  otpSendPerIp: {
    id: "auth.otp_send_ip",
    version: "otp-v1",
    scope: "ip",
    windowSeconds: 3600,
    steps: [
      { atCount: 30, state: "throttled", ttlSeconds: 15 * 60, severity: "low" },
      { atCount: 100, state: "temporarily_restricted", ttlSeconds: 60 * 60, severity: "high" },
    ],
  },
} as const satisfies Record<string, SecurityRule>;

/** Hisoblagich qiymatiga mos eng yuqori qadam (yo'q bo'lsa — NORMAL) */
export function stepFor(rule: SecurityRule, count: number): RuleStep | null {
  let hit: RuleStep | null = null;
  for (const s of rule.steps) if (count >= s.atCount) hit = s;
  return hit;
}

/** Aynan chegaraga yetganda (bir marta) hodisa yoziladi — har so'rovda emas */
export function crossedStep(rule: SecurityRule, count: number): RuleStep | null {
  return rule.steps.find((s) => s.atCount === count) ?? null;
}

const STATE_RANK: Record<RestrictionState, number> = { throttled: 1, challenge_required: 2, compromise_suspected: 3, temporarily_restricted: 4 };

export interface ActiveRestriction {
  state: RestrictionState;
  enforced: boolean;
  expiresAt: string;
}

/**
 * Faol cheklov so'rovni to'xtatadimi va qaysi xato kodi bilan.
 * Kuzatuv rejimidagi (enforced=false) cheklov hech qachon to'xtatmaydi.
 * throttled → "rate_limited" ("So'rovlar soni vaqtincha cheklangan…"),
 * challenge_required / temporarily_restricted → "temporarily_restricted" ("Xavfsizlik sababli…").
 */
export function blockingError(r: ActiveRestriction | null, now = Date.now()): "rate_limited" | "temporarily_restricted" | null {
  if (!r || !r.enforced || new Date(r.expiresAt).getTime() <= now) return null;
  if (r.state === "throttled") return "rate_limited";
  if (r.state === "compromise_suspected") return null; // kirishni to'xtatmaydi — qayta tasdiqlash talab qilinadi
  return "temporarily_restricted";
}

export function strongest(a: ActiveRestriction | null, b: ActiveRestriction | null): ActiveRestriction | null {
  if (!a) return b;
  if (!b) return a;
  if (a.enforced !== b.enforced) return a.enforced ? a : b;
  return STATE_RANK[a.state] >= STATE_RANK[b.state] ? a : b;
}
