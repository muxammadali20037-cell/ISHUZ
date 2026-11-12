import { describe, expect, it } from "vitest";
import { isNewFeature } from "./new-features";

describe("'Yangi' belgisi muddati", () => {
  it("muddatgacha ko'rinadi, keyin o'zi yo'qoladi", () => {
    expect(isNewFeature("ai", Date.parse("2026-11-12T12:00:00Z"))).toBe(true);
    expect(isNewFeature("map", Date.parse("2027-01-14T23:59:59Z"))).toBe(true);
    expect(isNewFeature("map", Date.parse("2027-01-15T00:00:00Z"))).toBe(false);
  });
});
