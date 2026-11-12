import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// to'liq muhit tekshiruvi (Supabase kalitlari) bu testga kerak emas — faqat AI kaliti o'qiladi
vi.mock("@/lib/env", () => ({ getServerEnv: () => ({ ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || undefined }) }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Claude modeli", () => {
  it("standart — Claude Sonnet 5.5", async () => {
    vi.stubEnv("ANTHROPIC_MODEL", "");
    const { AI_MODEL, AI_DEFAULT_MODEL } = await import("./client");
    expect(AI_DEFAULT_MODEL).toBe("claude-sonnet-5-5");
    expect(AI_MODEL).toBe("claude-sonnet-5-5");
  });

  it("ANTHROPIC_MODEL bilan almashtiriladi (bo'sh joylar olib tashlanadi)", async () => {
    vi.stubEnv("ANTHROPIC_MODEL", " claude-haiku-5-5 ");
    const { AI_MODEL } = await import("./client");
    expect(AI_MODEL).toBe("claude-haiku-5-5");
  });

  it("kalit yo'q — AI o'chiq, tekshiruv bo'sh ro'yxat (tarmoqqa so'rov yo'q)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const { getAiClient, claudeProbe } = await import("./client");
    expect(getAiClient()).toBeNull();
    expect(await claudeProbe()).toEqual([]);
  });
});
