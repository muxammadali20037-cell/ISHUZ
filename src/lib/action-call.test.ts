import { afterEach, describe, expect, it, vi } from "vitest";
import { callAction } from "./action-call";

describe("callAction", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("muvaffaqiyatli va server qaytargan xato natijani o'zgartirmaydi", async () => {
    expect(await callAction(async () => ({ ok: true, data: 1 }))).toEqual({ ok: true, data: 1 });
    expect(await callAction(async () => ({ ok: false, error: "validation" }))).toEqual({ ok: false, error: "validation" });
  });

  it("tarmoq istisnosi — 'network' (sahifa xato ekraniga tushmaydi)", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    expect(await callAction(async () => Promise.reject(new TypeError("Failed to fetch")))).toEqual({ ok: false, error: "network" });
  });

  it("brauzer oflayn — 'offline'", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(await callAction(async () => Promise.reject(new TypeError("Failed to fetch")))).toEqual({ ok: false, error: "offline" });
  });

  it("javob kelmasa — belgilangan vaqtdan keyin 'timeout' (cheksiz kutish yo'q)", async () => {
    vi.useFakeTimers();
    const pending = callAction(() => new Promise(() => undefined), 30_000);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await pending).toEqual({ ok: false, error: "timeout" });
  });
});
