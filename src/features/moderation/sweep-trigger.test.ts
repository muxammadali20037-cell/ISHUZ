import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const pending: Array<() => Promise<void>> = [];
vi.mock("next/server", () => ({ after: (cb: () => Promise<void>) => pending.push(cb) }));

const sweep = vi.fn();
vi.mock("./sweep", () => ({ sweepPublishedContent: (...a: unknown[]) => sweep(...a) }));

async function flush() {
  while (pending.length) await pending.shift()!();
}

describe("sweepSoon — eski e'lonlar tekshiruvi sayt trafigi bilan (javobdan keyin, cheklangan tezlikda)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-14T10:00:00Z"));
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test";
    sweep.mockReset();
    pending.length = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("ish qolgan bo'lsa ~10 soniyadan keyin yana, tugagach — soatiga bir marta", async () => {
    const { sweepSoon } = await import("./sweep-trigger");
    sweep.mockResolvedValue({ checked: 100, hidden: 2, banned: 1, done: false });
    sweepSoon();
    sweepSoon(); // bir vaqtda bittadan ortiq emas
    expect(pending).toHaveLength(1);
    await flush();
    expect(sweep).toHaveBeenCalledTimes(1);

    sweepSoon(); // hali 10 soniya o'tmagan
    expect(pending).toHaveLength(0);
    vi.advanceTimersByTime(10_001);
    sweep.mockResolvedValue({ checked: 3, hidden: 0, banned: 0, done: true });
    sweepSoon();
    await flush();
    expect(sweep).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(30 * 60_000);
    sweepSoon(); // tugagan — yarim soatda qayta tekshirmaydi
    expect(pending).toHaveLength(0);
    vi.advanceTimersByTime(31 * 60_000);
    sweepSoon();
    await flush();
    expect(sweep).toHaveBeenCalledTimes(3);
  });

  it("xato asosiy javobni buzmaydi va 2 daqiqadan keyin qayta uriniladi", async () => {
    const { sweepSoon } = await import("./sweep-trigger");
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    sweep.mockRejectedValue(new Error("db down"));
    sweepSoon();
    await flush();
    expect(err).toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    sweepSoon();
    expect(pending).toHaveLength(0);
    vi.advanceTimersByTime(61_000);
    sweep.mockResolvedValue({ checked: 0, hidden: 0, banned: 0, done: true });
    sweepSoon();
    await flush();
    expect(sweep).toHaveBeenCalledTimes(2);
    err.mockRestore();
  });

  it("server kaliti bo'lmasa (lokal, oldindan ko'rish) — hech narsa qilmaydi", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { sweepSoon } = await import("./sweep-trigger");
    sweepSoon();
    expect(pending).toHaveLength(0);
    expect(sweep).not.toHaveBeenCalled();
  });
});
