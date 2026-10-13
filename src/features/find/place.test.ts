import { describe, expect, it } from "vitest";
import { formatPlace, parsePlace } from "./place";

const ID = "11111111-2222-4333-8444-555555555555";

describe("eslab qolingan hudud (cookie)", () => {
  it("viloyat~tuman o'qiladi va yoziladi", () => {
    expect(parsePlace(`tashkent_city~${ID}`)).toEqual({ region: "tashkent_city", district: ID });
    expect(parsePlace("samarkand~all")).toEqual({ region: "samarkand", district: "all" });
    expect(formatPlace({ region: "samarkand", district: "all" })).toBe("samarkand~all");
  });
  it("noto'g'ri qiymat — e'tiborsiz", () => {
    for (const bad of [null, undefined, "", "tashkent_city", "<script>|all", `tashkent_city~x`, `Tashkent City~${ID}`, "~all", `tashkent_city|${ID}`]) expect(parsePlace(bad)).toBeNull();
  });
});
