import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/** Botdagi "Ochish" havolasi: bir martalik — shu brauzerda sessiya va sayt; eskirgan/ishlatilgan — kirish sahifasi */
const rpc = vi.hoisted(() => vi.fn());
const startSession = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
vi.mock("@/lib/rate-limit", () => ({ allowRate: vi.fn(async () => true) }));
vi.mock("@/lib/security/events", () => ({ logSecurityEvent: vi.fn(async () => null) }));
vi.mock("@/features/auth/telegram-session", () => ({
  AccountBlockedError: class AccountBlockedError extends Error {},
  startSessionForProfile: startSession,
}));
vi.mock("@/lib/telegram/bot", () => ({ miniAppBaseUrl: () => "https://ishuz.example" }));

const ID = "33333333-3333-4333-8333-333333333333";
const NONCE = "a".repeat(43);
const get = async (query: string) => {
  const { GET } = await import("./route");
  return GET(new NextRequest(`https://ishuz.example/api/auth/telegram-web/open?${query}`));
};

describe("GET /api/auth/telegram-web/open", () => {
  beforeEach(() => vi.clearAllMocks());

  it("to'g'ri havola — sessiya ochiladi va asosiy ekranga (/chat)", async () => {
    rpc.mockResolvedValue({ data: [{ status: "ok", profile_id: "p1", telegram_user_id: 555 }], error: null });
    const res = await get(`r=${ID}.${NONCE}&to=%2Fchat`);
    expect(rpc).toHaveBeenCalledWith("telegram_web_login_consume", expect.objectContaining({ p_id: ID }));
    expect(startSession).toHaveBeenCalledWith(expect.anything(), "p1", 555);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://ishuz.example/chat");
  });

  it("ishlatilgan yoki eskirgan havola — sessiyasiz, kirish sahifasiga", async () => {
    rpc.mockResolvedValue({ data: [{ status: "used", profile_id: null, telegram_user_id: null }], error: null });
    const res = await get(`r=${ID}.${NONCE}`);
    expect(startSession).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("https://ishuz.example/auth?next=%2Fchat");
  });

  it("noto'g'ri parametr va tashqi manzil — bazaga so'rovsiz, faqat sayt ichiga", async () => {
    const res = await get(`r=bad&to=https%3A%2F%2Fevil.example`);
    expect(rpc).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("https://ishuz.example/auth?next=%2Fchat");
  });
});
