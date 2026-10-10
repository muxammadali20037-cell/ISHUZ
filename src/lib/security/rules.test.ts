import { describe, expect, it } from "vitest";
import { RULES, blockingError, crossedStep, stepFor, strongest, type ActiveRestriction, type SecurityRule } from "./rules";

const future = new Date(Date.now() + 60_000).toISOString();
const past = new Date(Date.now() - 1_000).toISOString();

describe("holat mashinasi qoidalari", () => {
  it("NORMAL → CHALLENGE_REQUIRED → TEMPORARILY_RESTRICTED (telefon bo'yicha xatolar)", () => {
    const r = RULES.otpVerifyFailuresPerPhone;
    expect(stepFor(r, 9)).toBeNull();
    expect(stepFor(r, 10)?.state).toBe("challenge_required");
    expect(stepFor(r, 19)?.state).toBe("challenge_required");
    expect(stepFor(r, 20)?.state).toBe("temporarily_restricted");
    expect(stepFor(r, 500)?.state).toBe("temporarily_restricted");
  });

  it("hodisa faqat chegarani kesib o'tganda bir marta (har so'rovda emas)", () => {
    const r = RULES.otpSendPerIp;
    expect(crossedStep(r, 29)).toBeNull();
    expect(crossedStep(r, 30)?.state).toBe("throttled");
    expect(crossedStep(r, 31)).toBeNull();
    expect(crossedStep(r, 100)?.state).toBe("temporarily_restricted");
  });

  it("barcha qoidalar muddatli va doira cheklovidan oshmaydi (telefon/IP ≤ 1 soat)", () => {
    for (const rule of Object.values(RULES) as SecurityRule[]) {
      expect(rule.version).toMatch(/^[A-Za-z0-9._-]{1,32}$/);
      for (const s of rule.steps) {
        expect(s.ttlSeconds).toBeGreaterThan(0);
        expect(s.ttlSeconds).toBeLessThanOrEqual(rule.scope === "account" ? 7 * 86400 : 3600);
      }
      const counts = rule.steps.map((s) => s.atCount);
      expect([...counts].sort((a, b) => a - b)).toEqual(counts);
    }
  });
});

describe("blockingError — server qarori", () => {
  const r = (state: ActiveRestriction["state"], enforced: boolean, expiresAt = future): ActiveRestriction => ({ state, enforced, expiresAt });
  it("kuzatuv rejimi hech qachon to'xtatmaydi", () => {
    expect(blockingError(r("temporarily_restricted", false))).toBeNull();
  });
  it("muddati o'tgan cheklov — yo'q", () => {
    expect(blockingError(r("temporarily_restricted", true, past))).toBeNull();
  });
  it("throttled → rate_limited; challenge/restricted → temporarily_restricted; compromise → kirishni to'xtatmaydi", () => {
    expect(blockingError(r("throttled", true))).toBe("rate_limited");
    expect(blockingError(r("challenge_required", true))).toBe("temporarily_restricted");
    expect(blockingError(r("temporarily_restricted", true))).toBe("temporarily_restricted");
    expect(blockingError(r("compromise_suspected", true))).toBeNull();
    expect(blockingError(null)).toBeNull();
  });
  it("strongest: majburiy > kuzatuv, keyin holat darajasi", () => {
    expect(strongest(r("throttled", true), r("temporarily_restricted", false))?.enforced).toBe(true);
    expect(strongest(r("throttled", true), r("temporarily_restricted", true))?.state).toBe("temporarily_restricted");
    expect(strongest(null, r("throttled", true))?.state).toBe("throttled");
  });
});
