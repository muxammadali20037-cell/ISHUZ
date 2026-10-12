import { describe, expect, it } from "vitest";
import { isCityRegion } from "./city";

describe("isCityRegion", () => {
  it("Toshkent shahri — shahar (slug yoki nom bo'yicha)", () => {
    expect(isCityRegion({ slug: "tashkent_city" })).toBe(true);
    expect(isCityRegion({ name_uz: "Toshkent shahri" })).toBe(true);
  });
  it("viloyatlar — shahar emas", () => {
    expect(isCityRegion({ slug: "tashkent_region", name_uz: "Toshkent viloyati" })).toBe(false);
    expect(isCityRegion({ slug: "samarkand" })).toBe(false);
    expect(isCityRegion(null)).toBe(false);
  });
});
