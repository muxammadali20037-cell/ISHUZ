import { beforeEach, describe, expect, it, vi } from "vitest";

/** Kasb rasmi → e'lon qoralamasi: tayyori xarajatsiz qo'yiladi; yo'q bo'lsa kasb rasmi yaratiladi; begona qoralamaga — yo'q */
const ready = vi.hoisted(() => vi.fn());
const generate = vi.hoisted(() => vi.fn());
const allowed = vi.hoisted(() => vi.fn(async () => true));
const upserts = vi.hoisted(() => [] as { row: Record<string, unknown>; opts: unknown }[]);

vi.mock("server-only", () => ({}));
vi.mock("@/lib/profession-images/server", () => ({ readyProfessionImage: ready, generateProfessionImage: generate }));
vi.mock("./server", () => ({ draftAllowed: allowed }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      upsert: async (row: Record<string, unknown>, opts: unknown) => {
        upserts.push({ row, opts });
        return { error: null };
      },
    }),
  }),
}));

const { presetDraftImage, professionDraftImage } = await import("./profession-draft");
const D = "22222222-2222-4222-8222-222222222222";
const P = "33333333-3333-4333-8333-333333333333";

describe("kasb rasmi → qoralama", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upserts.length = 0;
    allowed.mockResolvedValue(true);
  });

  it("preset: tayyor kasb rasmi qoralamaga yoziladi (fayl nusxalanmaydi, belgilanadi)", async () => {
    ready.mockResolvedValue("https://cdn/p.jpg");
    expect(await presetDraftImage("vacancy", D, "u1", P)).toEqual({ ok: true, url: "https://cdn/p.jpg" });
    expect(upserts[0]!.row).toMatchObject({ entity: "vacancy", entity_id: D, owner_profile_id: "u1", status: "ready", image_url: "https://cdn/p.jpg", storage_path: null, prompt: `profession:${P}` });
    expect(upserts[0]!.opts).toEqual({ onConflict: "entity,entity_id" });
    expect(generate).not.toHaveBeenCalled();
  });

  it("preset: rasmi yo'q — no_preset; usta e'loni — no_preset; begona qoralama — forbidden", async () => {
    ready.mockResolvedValue(null);
    expect(await presetDraftImage("worker", D, "u1", P)).toEqual({ ok: false, error: "no_preset" });
    expect(await presetDraftImage("master", D, "u1", P)).toEqual({ ok: false, error: "no_preset" });
    ready.mockResolvedValue("https://cdn/p.jpg");
    allowed.mockResolvedValue(false);
    expect(await presetDraftImage("worker", D, "u1", P)).toEqual({ ok: false, error: "forbidden" });
    expect(upserts).toHaveLength(0);
  });

  it("«Rasm yaratish»: tayyori bo'lsa — xarajatsiz o'sha; yo'q bo'lsa — kasb rasmi yaratilib qo'yiladi", async () => {
    ready.mockResolvedValue("https://cdn/p.jpg");
    expect(await professionDraftImage("worker", D, "u1", P)).toEqual({ ok: true, url: "https://cdn/p.jpg" });
    expect(generate).not.toHaveBeenCalled();

    ready.mockResolvedValue(null);
    generate.mockResolvedValue({ ok: true, url: "https://cdn/new.jpg" });
    expect(await professionDraftImage("vacancy", D, "u1", P)).toEqual({ ok: true, url: "https://cdn/new.jpg" });
    expect(generate).toHaveBeenCalledWith(P, "u1");
    expect(upserts.at(-1)!.row).toMatchObject({ image_url: "https://cdn/new.jpg", entity: "vacancy" });
  });

  it("chegara va xato — o'sha javob; band/o'chirilgan — null (oddiy e'lon rasmi); begona — forbidden", async () => {
    ready.mockResolvedValue(null);
    generate.mockResolvedValue({ ok: false, error: "user_limit" });
    expect(await professionDraftImage("worker", D, "u1", P)).toEqual({ ok: false, error: "user_limit" });
    generate.mockResolvedValue({ ok: false, error: "busy" });
    expect(await professionDraftImage("worker", D, "u1", P)).toBeNull();
    generate.mockResolvedValue({ ok: false, error: "disabled" });
    expect(await professionDraftImage("worker", D, "u1", P)).toBeNull();
    expect(await professionDraftImage("master", D, "u1", P)).toBeNull();
    allowed.mockResolvedValue(false);
    expect(await professionDraftImage("worker", D, "u1", P)).toEqual({ ok: false, error: "forbidden" });
    expect(upserts).toHaveLength(0);
  });
});
