import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ publicEnv: { NEXT_PUBLIC_SUPABASE_URL: "http://localhost", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" } }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/features/search/dictionary", () => ({ getSearchDictionary: async () => ({}) }));
vi.mock("@/lib/profession-images/server", () => ({ getProfessionImages: async () => ({}) }));

const rpc = vi.fn();
const fromChain = { select: () => fromChain, in: () => fromChain, not: async () => ({ data: [] }) };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc, from: () => fromChain }) }));

const nodeResult = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: nodeResult }) }) }) }),
}));
const trail = vi.fn();
vi.mock("@/features/professions/queries", () => ({ getProfessionTrail: (...a: unknown[]) => trail(...a) }));

const { findJobs, findWorkers, getNodeInfo } = await import("./queries");

const params = { mode: "jobs", p: null, q: "", region: null, district: null, salary: null, schedule: null, noexp: false, exp: false, page: 1 } as never;
const place = { regionId: null, districtId: null, remote: false };

afterEach(() => {
  rpc.mockReset();
  nodeResult.mockReset();
  trail.mockReset();
  vi.restoreAllMocks();
});

describe("qidiruv: texnik xato bo'sh natija emas", () => {
  it("RPC xatosi → ok:false va errorId (so'rov matni logga yozilmaydi)", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    rpc.mockResolvedValueOnce({ data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } });
    const res = await findJobs({ ...(params as object), q: "+998901234567 haydovchi" } as never, place);
    expect(res.ok).toBe(false);
    expect(!res.ok && res.errorId).toMatch(/^[0-9a-f]{8}$/);
    const line = String(log.mock.calls[0]![0]);
    expect(line).toContain('"code":"57014"');
    expect(line).not.toContain("998901234567");
  });

  it("muvaffaqiyatli, lekin 0 ta — ok:true, total 0 (haqiqiy bo'sh natija)", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    const res = await findJobs(params, place);
    expect(res).toMatchObject({ ok: true, items: [], total: 0 });
  });

  it("ishchilar qidiruvi ham xuddi shunday ajratadi", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST301", message: "JWT expired" } });
    expect((await findWorkers(params, place)).ok).toBe(false);
    rpc.mockResolvedValueOnce({ data: [{ id: "w1", profession_node_id: null, total_count: 3 }], error: null });
    expect(await findWorkers(params, place)).toMatchObject({ ok: true, total: 3 });
  });
});

describe("kasb tuguni: yo'q va xato farqlanadi", () => {
  it("bunday tugun yo'q → null (kasb qayta so'raladi)", async () => {
    trail.mockResolvedValueOnce([]);
    nodeResult.mockResolvedValueOnce({ data: null, error: null });
    await expect(getNodeInfo("00000000-0000-4000-8000-000000000000")).resolves.toBeNull();
  });

  it("texnik xato → istisno (xato sahifasi, tanlov jim yo'qolmaydi)", async () => {
    trail.mockResolvedValueOnce([]);
    nodeResult.mockResolvedValueOnce({ data: null, error: { code: "08006", message: "connection failure" } });
    await expect(getNodeInfo("00000000-0000-4000-8000-000000000000")).rejects.toThrow("node_lookup_failed");
    trail.mockResolvedValueOnce([]);
    nodeResult.mockResolvedValueOnce({ data: { id: "x", categories: null }, error: null });
    await expect(getNodeInfo("00000000-0000-4000-8000-000000000000")).rejects.toThrow("node_trail_failed");
  });
});
