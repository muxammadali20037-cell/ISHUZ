import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/env", () => ({ getServerEnv: () => ({ SUPABASE_SERVICE_ROLE_KEY: "test-service-role-secret" }) }));

const { generateLoginCode, hashLoginCode, loginCodeMatches, normalizeContactPhone, telegramEmail } = await import("./telegram-session");

describe("normalizeContactPhone", () => {
  it("Telegram kontakt formatlarini E.164 ga keltiradi", () => {
    expect(normalizeContactPhone("998901234567")).toBe("+998901234567");
    expect(normalizeContactPhone("+998 90 123-45-67")).toBe("+998901234567");
    expect(normalizeContactPhone("79161234567")).toBe("+79161234567");
  });
  it("noto'g'ri uzunlik → null", () => {
    expect(normalizeContactPhone("12345")).toBeNull();
    expect(normalizeContactPhone("1234567890123456")).toBeNull();
  });
});

describe("login kodlari", () => {
  it("6 xonali kod", () => {
    for (let i = 0; i < 50; i++) expect(generateLoginCode()).toMatch(/^\d{6}$/);
  });
  it("to'g'ri kod mos keladi, boshqa kod/raqam — yo'q", () => {
    const h = hashLoginCode("+998901234567", "123456");
    expect(loginCodeMatches("+998901234567", "123456", h)).toBe(true);
    expect(loginCodeMatches("+998901234567", "123457", h)).toBe(false);
    expect(loginCodeMatches("+998901234568", "123456", h)).toBe(false);
  });
  it("xesh sirga bog'liq (bazadagi xeshdan kodni tiklab bo'lmaydi)", () => {
    expect(hashLoginCode("+998901234567", "123456", "a")).not.toBe(hashLoginCode("+998901234567", "123456", "b"));
  });
  it("buzilgan xesh → false (xato tashlamaydi)", () => {
    expect(loginCodeMatches("+998901234567", "123456", "zz")).toBe(false);
    expect(loginCodeMatches("+998901234567", "123456", "")).toBe(false);
  });
  it("telegramEmail barqaror", () => {
    expect(telegramEmail(42)).toBe("tg_42@telegram.ishuz.local");
  });
});
