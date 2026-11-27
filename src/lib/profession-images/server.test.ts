import { beforeEach, describe, expect, it, vi } from "vitest";

/** Kasb rasmi: OpenAI (e'lon rasmi bilan bir xil), navbat bazada, tekshiruvdan o'tgani saqlanadi; xatoda eski rasm qoladi */
const env = vi.hoisted(() => ({ value: { OPENAI_API_KEY: "sk-test", SUPABASE_SERVICE_ROLE_KEY: "srv" } as Record<string, string | undefined> }));
const rpc = vi.hoisted(() => vi.fn());
const upload = vi.hoisted(() => vi.fn(async (...args: unknown[]) => ({ error: null, args })));
const updates = vi.hoisted(() => [] as Record<string, unknown>[]);
const verdict = vi.hoisted(() => ({ value: "allow" as string }));
const current = vi.hoisted(() => ({ value: { attempts: 1, image_url: null as string | null } }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ getServerEnv: () => env.value, publicEnv: { NEXT_PUBLIC_SUPABASE_URL: "http://x", NEXT_PUBLIC_SUPABASE_ANON_KEY: "a" } }));
vi.mock("@/lib/ai/usage", () => ({ logAiUsage: vi.fn(async () => undefined) }));
vi.mock("@/features/moderation/service", () => ({ checkGeneratedImage: vi.fn(async () => verdict.value) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc,
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: () => q,
        in: async () => ({ data: [], error: null }),
        maybeSingle: async () => ({
          data:
            table === "profession_nodes"
              ? { id: "n1", kind: "profession", name_en: "Cook", name_ru: "Повар", name_uz: "Oshpaz", path: [], category: { slug: "food" } }
              : current.value,
          error: null,
        }),
        update: (row: Record<string, unknown>) => {
          updates.push(row);
          return q;
        },
        then: (ok: (v: { data: null; error: null }) => unknown) => Promise.resolve({ data: null, error: null }).then(ok),
      };
      return q;
    },
    storage: { from: () => ({ upload, getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn.example/${p}` } }) }) },
  }),
}));

const { generateProfessionImage, imageGenConfig } = await import("./server");

describe("kasb rasmi (generateProfessionImage)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updates.length = 0;
    env.value = { OPENAI_API_KEY: "sk-test", SUPABASE_SERVICE_ROLE_KEY: "srv" };
    verdict.value = "allow";
    current.value = { attempts: 1, image_url: null };
    rpc.mockResolvedValue({ data: "ok", error: null });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: Buffer.from("jpeg").toString("base64") }] }), { status: 200 })));
  });

  it("provayder: OpenAI birinchi (e'lon rasmlari kaliti), bo'lmasa Gemini, ikkalasi yo'q — null", () => {
    expect(imageGenConfig()?.kind).toBe("openai");
    env.value = { IMAGE_GEN_API_KEY: "g", SUPABASE_SERVICE_ROLE_KEY: "srv" };
    expect(imageGenConfig()?.kind).toBe("gemini");
    env.value = {};
    expect(imageGenConfig()).toBeNull();
  });

  it("navbat → OpenAI (yuzsiz e'lon sahnasi) → tekshiruv → yangi nom bilan saqlanadi → ready", async () => {
    const res = await generateProfessionImage("n1", "u1");
    expect(res).toEqual({ ok: true, url: expect.stringMatching(/^https:\/\/cdn\.example\/n1-\d+\.jpg$/) });
    const [, args] = rpc.mock.calls[0]!;
    expect(rpc.mock.calls[0]![0]).toBe("claim_profession_image_by");
    expect(args).toMatchObject({ p_node_id: "n1", p_owner: "u1", p_batch: false, p_force: false, p_model: "gpt-image-1.5" });
    expect(args.p_prompt).toMatch(/Job: Cook\./);
    expect(args.p_prompt).toMatch(/No portrait/);
    const body = JSON.parse(String((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body));
    expect(body).toMatchObject({ size: "1536x1024", output_format: "jpeg" });
    expect(upload.mock.calls[0]![0]).toMatch(/^n1-\d+\.jpg$/);
    expect(updates.at(-1)).toMatchObject({ status: "ready", last_error: null });
  });

  it("navbat bermasa — generatsiya yo'q (chegara, band, tayyor)", async () => {
    for (const code of ["user_limit", "busy", "exists", "forbidden"]) {
      rpc.mockResolvedValueOnce({ data: code, error: null });
      expect(await generateProfessionImage("n1", "u1", { batch: true })).toEqual({ ok: false, error: code });
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(rpc.mock.calls[0]![1]).toMatchObject({ p_batch: true });
  });

  it("moderatsiyadan o'tmadi — saqlanmaydi; almashtirishda eski rasm qoladi (ready)", async () => {
    verdict.value = "reject";
    current.value = { attempts: 2, image_url: "https://cdn.example/old.jpg" };
    expect(await generateProfessionImage("n1", "admin", { force: true })).toEqual({ ok: false, error: "moderation" });
    expect(upload).not.toHaveBeenCalled();
    expect(updates.at(-1)).toMatchObject({ status: "ready", last_error: "moderation_reject" });
  });

  it("provayder ishlamayapti — urinish sanalmaydi, rasm bo'lmasa failed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":{"code":"rate_limit_exceeded"}}', { status: 429 })));
    expect(await generateProfessionImage("n1", "u1")).toEqual({ ok: false, error: "provider_unavailable" });
    expect(updates.at(-1)).toMatchObject({ status: "failed", attempts: 0 });
  });

  it("kalit yo'q — not_configured, bazaga ham so'rov yo'q", async () => {
    env.value = {};
    expect(await generateProfessionImage("n1", "u1")).toEqual({ ok: false, error: "not_configured" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
