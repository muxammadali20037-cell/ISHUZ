import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/** POST /api/listing-image: faqat kirgan foydalanuvchi, to'g'ri so'rov; tayyor bo'lsa — kanaldagi rasm ham yangilanadi */
const session = vi.hoisted(() => ({ value: { userId: "u1", profile: { is_blocked: false } } as unknown }));
const generate = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn(async () => 1));
const after = vi.hoisted(() => vi.fn((fn: () => unknown) => fn()));

vi.mock("server-only", () => ({}));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after }));
vi.mock("@/features/auth/session", () => ({ getSession: async () => session.value }));
vi.mock("@/lib/rate-limit", () => ({ allowRate: vi.fn(async () => true) }));
vi.mock("@/lib/security/guard", () => ({ rejectUnsafeRequest: () => null }));
vi.mock("@/features/listing-image/server", () => ({ generateListingImage: generate }));
vi.mock("@/features/telegram-channel/autopost", () => ({ refreshChannelPhoto: refresh }));

const ID = "11111111-1111-4111-8111-111111111111";
const post = async (body: unknown) => {
  const { POST } = await import("./route");
  return POST(new NextRequest("https://ishuz.example/api/listing-image", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
};

describe("POST /api/listing-image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.value = { userId: "u1", profile: { is_blocked: false } };
  });

  it("kirmagan — 401, generatsiya yo'q", async () => {
    session.value = null;
    const res = await post({ entity: "vacancy", id: ID });
    expect(res.status).toBe(401);
    expect(generate).not.toHaveBeenCalled();
  });

  it("noto'g'ri so'rov — 400", async () => {
    expect((await post({ entity: "company", id: ID })).status).toBe(400);
    expect((await post({ entity: "vacancy", id: "x" })).status).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });

  it("tayyor — manzil qaytadi va kanaldagi post rasmi yangilanadi", async () => {
    generate.mockResolvedValue({ ok: true, url: "https://cdn.example/a.jpg" });
    const res = await post({ entity: "worker", id: ID });
    expect(await res.json()).toEqual({ ok: true, url: "https://cdn.example/a.jpg" });
    expect(generate).toHaveBeenCalledWith("worker", ID, "u1");
    expect(refresh).toHaveBeenCalledWith("worker", ID, expect.any(String));
  });

  it("boshqaning e'loni — 403, kanalga tegilmaydi", async () => {
    generate.mockResolvedValue({ ok: false, error: "forbidden" });
    const res = await post({ entity: "vacancy", id: ID });
    expect(res.status).toBe(403);
    expect(refresh).not.toHaveBeenCalled();
  });
});
