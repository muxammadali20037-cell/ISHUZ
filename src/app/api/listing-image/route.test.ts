import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/** POST /api/listing-image: faqat kirgan foydalanuvchi, to'g'ri so'rov; tayyor bo'lsa — kanaldagi rasm ham yangilanadi */
const session = vi.hoisted(() => ({ value: { userId: "u1", profile: { is_blocked: false } } as unknown }));
const generate = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn(async () => 1));
const after = vi.hoisted(() => vi.fn((fn: () => unknown) => fn()));
const draft = vi.hoisted(() => vi.fn());
const preset = vi.hoisted(() => vi.fn());
const shared = vi.hoisted(() => vi.fn());
const allowRate = vi.hoisted(() => vi.fn(async () => true));

vi.mock("server-only", () => ({}));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after }));
vi.mock("@/features/auth/session", () => ({ getSession: async () => session.value }));
vi.mock("@/lib/rate-limit", () => ({ allowRate }));
vi.mock("@/lib/security/guard", () => ({ rejectUnsafeRequest: () => null }));
vi.mock("@/features/listing-image/server", () => ({ generateListingImage: generate, generateDraftImage: draft }));
vi.mock("@/features/listing-image/profession-draft", () => ({ presetDraftImage: preset, professionDraftImage: shared }));
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

  describe("kasb rasmi (2026-11-27)", () => {
    const D = "22222222-2222-4222-8222-222222222222";
    const P = "33333333-3333-4333-8333-333333333333";

    it("preset — faqat tayyor kasb rasmi (generatsiyasiz), alohida chegara bilan", async () => {
      preset.mockResolvedValue({ ok: true, url: "https://cdn.example/p.jpg" });
      const res = await post({ entity: "vacancy", draft: D, professionId: P, preset: true });
      expect(await res.json()).toEqual({ ok: true, url: "https://cdn.example/p.jpg" });
      expect(preset).toHaveBeenCalledWith("vacancy", D, "u1", P);
      expect(shared).not.toHaveBeenCalled();
      expect(draft).not.toHaveBeenCalled();
      expect(allowRate).toHaveBeenCalledWith(expect.stringMatching(/^listing-image-preset:ip:/), 120, 3600);
    });

    it("preset, kasbsiz — no_preset, hech narsa chaqirilmaydi", async () => {
      const res = await post({ entity: "worker", draft: D, preset: true });
      expect(await res.json()).toEqual({ ok: false, error: "no_preset" });
      expect(preset).not.toHaveBeenCalled();
    });

    it("«Rasm yaratish» — avval kasb rasmi; u yo'li bo'lmasa — oddiy e'lon rasmi", async () => {
      shared.mockResolvedValue({ ok: true, url: "https://cdn.example/s.jpg" });
      expect(await (await post({ entity: "worker", draft: D, professionId: P, title: "Oshpaz" })).json()).toEqual({ ok: true, url: "https://cdn.example/s.jpg" });
      expect(shared).toHaveBeenCalledWith("worker", D, "u1", P);
      expect(draft).not.toHaveBeenCalled();
      expect(allowRate).toHaveBeenCalledWith(expect.stringMatching(/^listing-image:ip:/), 20, 3600);

      shared.mockResolvedValue(null);
      draft.mockResolvedValue({ ok: true, url: "https://cdn.example/d.jpg" });
      expect(await (await post({ entity: "worker", draft: D, professionId: P, title: "Oshpaz" })).json()).toEqual({ ok: true, url: "https://cdn.example/d.jpg" });
      expect(draft).toHaveBeenCalledWith("worker", D, "u1", { professionId: P, title: "Oshpaz", masterCategory: null });
    });

    it("«Boshqa rasm» (unique) — kasb rasmiga tegilmaydi", async () => {
      draft.mockResolvedValue({ ok: true, url: "https://cdn.example/u.jpg" });
      await post({ entity: "vacancy", draft: D, professionId: P, unique: true });
      expect(shared).not.toHaveBeenCalled();
      expect(draft).toHaveBeenCalledTimes(1);
    });
  });
});
