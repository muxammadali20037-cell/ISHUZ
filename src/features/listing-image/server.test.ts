import { beforeEach, describe, expect, it, vi } from "vitest";

/** E'lon rasmi: faqat egasi, xarajat chegarasi bazada, yaratilgan rasm tekshiriladi, keyin saqlanadi */
const env = vi.hoisted(() => ({ value: { OPENAI_API_KEY: "sk-test", SUPABASE_SERVICE_ROLE_KEY: "srv" } as Record<string, string | undefined> }));
const rpc = vi.hoisted(() => vi.fn());
const upload = vi.hoisted(() => vi.fn(async () => ({ error: null })));
const updates = vi.hoisted(() => [] as Record<string, unknown>[]);
const verdict = vi.hoisted(() => ({ value: "allow" as string }));
const listing = vi.hoisted(() => ({ value: { owner_profile_id: "owner-1", title: "Farrosh", category: { slug: "cleaning" }, profession: { name_en: "Cleaner", name_ru: "Уборщик", name_uz: "Farrosh" } } as Record<string, unknown> | null }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ getServerEnv: () => env.value, publicEnv: { NEXT_PUBLIC_SUPABASE_URL: "http://x", NEXT_PUBLIC_SUPABASE_ANON_KEY: "a" } }));
vi.mock("@/lib/ai/usage", () => ({ logAiUsage: vi.fn(async () => undefined) }));
vi.mock("@/features/moderation/service", () => ({ checkGeneratedImage: vi.fn(async () => verdict.value) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc,
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({ data: listing.value, error: null }),
        update: (row: Record<string, unknown>) => {
          updates.push(row);
          return q;
        },
      };
      return q;
    },
    storage: { from: () => ({ upload, getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn.example/${p}` } }) }) },
  }),
}));

const { generateListingImage, listingImageEnabled } = await import("./server");
const ID = "11111111-1111-4111-8111-111111111111";

describe("e'lon rasmi (generateListingImage)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updates.length = 0;
    env.value = { OPENAI_API_KEY: "sk-test", SUPABASE_SERVICE_ROLE_KEY: "srv" };
    verdict.value = "allow";
    listing.value = { owner_profile_id: "owner-1", title: "Farrosh", category: { slug: "cleaning" }, profession: { name_en: "Cleaner", name_ru: "Уборщик", name_uz: "Farrosh" } };
    rpc.mockResolvedValue({ data: "ok", error: null });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: Buffer.from("jpeg-bytes").toString("base64") }] }), { status: 200 })),
    );
  });

  it("kalit yo'q — savol ham, so'rov ham yo'q", async () => {
    env.value = { SUPABASE_SERVICE_ROLE_KEY: "srv" };
    expect(listingImageEnabled()).toBe(false);
    expect(await generateListingImage("vacancy", ID, "owner-1")).toEqual({ ok: false, error: "not_configured" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("boshqaning e'loni — rad, OpenAI'ga so'rov yo'q", async () => {
    expect(await generateListingImage("vacancy", ID, "someone-else")).toEqual({ ok: false, error: "forbidden" });
    expect(rpc).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("kunlik chegara — OpenAI'ga so'rov yo'q, sabab qaytadi", async () => {
    rpc.mockResolvedValue({ data: "user_limit", error: null });
    expect(await generateListingImage("vacancy", ID, "owner-1")).toEqual({ ok: false, error: "user_limit" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("muvaffaqiyat: so'rov (matnsiz, kasbga mos) → tekshiruv → saqlash → ready", async () => {
    const res = await generateListingImage("vacancy", ID, "owner-1");
    expect(res.ok).toBe(true);
    const [url, init] = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/images/generations");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ model: "gpt-image-1.5", size: "1536x1024", quality: "medium", n: 1 });
    expect(body.prompt).toContain("Job: Cleaner.");
    expect(body.prompt).toMatch(/no text/);
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer sk-test");
    expect(rpc).toHaveBeenCalledWith("claim_listing_image", expect.objectContaining({ p_entity: "vacancy", p_entity_id: ID, p_owner: "owner-1" }));
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^vacancy/${ID}-\\d+\\.jpg$`)), expect.any(Buffer), expect.objectContaining({ contentType: "image/jpeg" }));
    expect(updates.at(-1)).toMatchObject({ status: "ready" });
    if (res.ok) expect(res.url).toMatch(/^https:\/\/cdn\.example\/vacancy\//);
  });

  it("yaratilgan rasm tekshiruvdan o'tmasa — saqlanmaydi, failed", async () => {
    verdict.value = "reject";
    expect(await generateListingImage("vacancy", ID, "owner-1")).toEqual({ ok: false, error: "moderation" });
    expect(upload).not.toHaveBeenCalled();
    expect(updates.at(-1)).toMatchObject({ status: "failed" });
  });

  it("provayder xatosi — failed, foydalanuvchiga umumiy xato", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":{"code":"billing_hard_limit_reached"}}', { status: 400 })));
    listing.value = { profile_id: "owner-1", custom_profession: null, headline: "Haydovchi", profession: { name_en: "Driver", name_ru: "Водитель", name_uz: "Haydovchi" } };
    expect(await generateListingImage("worker", ID, "owner-1")).toEqual({ ok: false, error: "generation_failed" });
    expect(updates.at(-1)).toMatchObject({ status: "failed", last_error: "provider_http_400_billing_hard_limit_reached" });
  });
});
