import { describe, expect, it } from "vitest";
import { resolvePeriod } from "./period";

// 2026-10-08 02:00 Toshkent = 2026-10-07 21:00 UTC
const NOW = Date.parse("2026-10-07T21:00:00Z");

describe("statistika davri (Toshkent vaqti)", () => {
  it("Bugun — Toshkent yarim tunidan", () => {
    const p = resolvePeriod("today", undefined, undefined, NOW);
    expect(p.from.toISOString()).toBe("2026-10-07T19:00:00.000Z");
    expect(p.to.toISOString()).toBe("2026-10-08T19:00:00.000Z");
    expect(p.fromDay).toBe("2026-10-08");
    expect(p.toDay).toBe("2026-10-08");
  });
  it("7 kun — bugun bilan birga 7 kun", () => {
    const p = resolvePeriod("7", undefined, undefined, NOW);
    expect(p.fromDay).toBe("2026-10-02");
    expect(p.toDay).toBe("2026-10-08");
  });
  it("tanlangan oraliq", () => {
    const p = resolvePeriod("custom", "2026-09-01", "2026-09-30", NOW);
    expect(p.from.toISOString()).toBe("2026-08-31T19:00:00.000Z");
    expect(p.to.toISOString()).toBe("2026-09-30T19:00:00.000Z");
  });
  it("noto'g'ri oraliq — 30 kun", () => {
    expect(resolvePeriod("custom", "2026-09-30", "2026-09-01", NOW).kind).toBe("30");
    expect(resolvePeriod("custom", "x", "y", NOW).kind).toBe("30");
    expect(resolvePeriod(undefined, undefined, undefined, NOW).fromDay).toBe("2026-09-09");
  });
});
