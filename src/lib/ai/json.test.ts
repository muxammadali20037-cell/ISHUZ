import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ getServerEnv: () => ({ GEMINI_API_KEY: "g-key" }) }));
const geminiJson = vi.fn();
vi.mock("./gemini", () => ({ geminiJson, AiBusyError: class extends Error {} }));
vi.mock("./client", () => ({ AI_MODEL: "test-model", getAiClient: () => null }));
vi.mock("./usage", () => ({ logAiUsage: vi.fn() }));
const hitRate = vi.fn();
vi.mock("@/lib/rate-limit", () => ({ hitRate }));
const logSecurityEvent = vi.fn();
vi.mock("@/lib/security/events", () => ({ logSecurityEvent }));

const { aiJson, AiUnavailableError } = await import("./json");

const schema = z.object({ ok: z.boolean() });
const ok = (count: number) => ({ ok: true, count });
const limited = (count: number) => ({ ok: false, reason: "limited", count });

afterEach(() => {
  geminiJson.mockReset();
  hitRate.mockReset();
  logSecurityEvent.mockReset();
});

describe("aiJson kunlik byudjeti (xarajat hujumi)", () => {
  it("byudjet ichida — AI chaqiriladi; funksiya va umumiy hisoblagich alohida", async () => {
    hitRate.mockResolvedValueOnce(ok(10)).mockResolvedValueOnce(ok(20));
    geminiJson.mockResolvedValueOnce({ ok: true });
    await expect(aiJson(schema, "s", "u", { feature: "draft_vacancy" })).resolves.toEqual({ ok: true });
    expect(hitRate.mock.calls.map((c) => c[0])).toEqual(["ai:day:draft_vacancy", "ai:day:user_total"]);
    expect(hitRate.mock.calls[0]![1]).toBe(3000);
    expect(hitRate.mock.calls[1]![1]).toBe(12000);
  });

  it("funksiya chegarasi oshdi — AI chaqirilmaydi, ai_budget_exhausted; hodisa faqat chegaradan o'tgan birinchi so'rovda", async () => {
    hitRate.mockResolvedValueOnce(limited(3001)).mockResolvedValueOnce(ok(5000));
    const err = await aiJson(schema, "s", "u", { feature: "draft_vacancy" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiUnavailableError);
    expect((err as Error).message).toBe("ai_budget_exhausted");
    expect(geminiJson).not.toHaveBeenCalled();
    expect(logSecurityEvent).toHaveBeenCalledTimes(1);
    expect(logSecurityEvent.mock.calls[0]![0]).toMatchObject({ type: "cost.ai_budget_exhausted", severity: "high", reason: "draft_vacancy" });

    hitRate.mockResolvedValueOnce(limited(3002)).mockResolvedValueOnce(ok(5001));
    await expect(aiJson(schema, "s", "u", { feature: "draft_vacancy" })).rejects.toThrow("ai_budget_exhausted");
    expect(logSecurityEvent).toHaveBeenCalledTimes(1);
  });

  it("umumiy chegara oshdi — boshqa funksiya ham to'xtaydi", async () => {
    hitRate.mockResolvedValueOnce(ok(1)).mockResolvedValueOnce(limited(12001));
    await expect(aiJson(schema, "s", "u", { feature: "search_parse" })).rejects.toThrow("ai_budget_exhausted");
    expect(geminiJson).not.toHaveBeenCalled();
    expect(logSecurityEvent.mock.calls[0]![0]).toMatchObject({ details: { limit: 12000 } });
  });

  it("hisoblagich ishlamasa (DB uzildi) — fail-closed: AI chaqirilmaydi", async () => {
    hitRate.mockResolvedValue({ ok: false, reason: "unavailable" });
    await expect(aiJson(schema, "s", "u", { feature: "draft_worker" })).rejects.toThrow("ai_budget_exhausted");
    expect(geminiJson).not.toHaveBeenCalled();
    expect(logSecurityEvent).not.toHaveBeenCalled();
  });

  it("noma'lum funksiya — 'other' chegarasi; moderatsiya o'z limiti bilan (byudjetdan tashqari)", async () => {
    hitRate.mockResolvedValueOnce(ok(1)).mockResolvedValueOnce(ok(1));
    geminiJson.mockResolvedValueOnce({ ok: true });
    await aiJson(schema, "s", "u", { feature: "something_new" });
    expect(hitRate.mock.calls[0]![1]).toBe(2000);

    hitRate.mockReset();
    geminiJson.mockResolvedValueOnce({ ok: true });
    await aiJson(schema, "s", "u", { feature: "moderation_text" });
    expect(hitRate).not.toHaveBeenCalled();
  });
});
