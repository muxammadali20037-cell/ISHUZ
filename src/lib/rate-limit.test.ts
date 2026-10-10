import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
const { hitRate } = await import("./rate-limit");

describe("hitRate (fail-closed atomik hisoblagich)", () => {
  beforeEach(() => vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key"));
  afterEach(() => {
    vi.unstubAllEnvs();
    rpc.mockReset();
  });

  it("soni chegaragacha — ok, oshsa — limited", async () => {
    rpc.mockResolvedValueOnce({ data: 3, error: null });
    expect(await hitRate("k", 3, 60)).toEqual({ ok: true, count: 3 });
    rpc.mockResolvedValueOnce({ data: 4, error: null });
    expect(await hitRate("k", 3, 60)).toEqual({ ok: false, reason: "limited", count: 4 });
  });

  it("DB xatosi yoki istisno — unavailable (fail-closed, ruxsat berilmaydi)", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "57014", message: "timeout" } });
    expect(await hitRate("k", 3, 60)).toEqual({ ok: false, reason: "unavailable" });
    rpc.mockRejectedValueOnce(new Error("network"));
    expect(await hitRate("k", 3, 60)).toEqual({ ok: false, reason: "unavailable" });
  });

  it("0056 qo'llanmagan baza: eski check_rate_limit ga qaytadi (chegara saqlanadi)", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "not found" } }).mockResolvedValueOnce({ data: true, error: null });
    expect(await hitRate("k", 3, 60)).toEqual({ ok: true, count: -1 });
    expect(rpc).toHaveBeenLastCalledWith("check_rate_limit", { p_key: "k", p_limit: 3, p_window_seconds: 60 });
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "not found" } }).mockResolvedValueOnce({ data: false, error: null });
    expect(await hitRate("k", 3, 60)).toEqual({ ok: false, reason: "limited", count: 4 });
  });

  it("service kaliti yo'q (lokal ishlab chiqish) — ruxsat", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(await hitRate("k", 3, 60)).toEqual({ ok: true, count: 0 });
    expect(rpc).not.toHaveBeenCalled();
  });
});
