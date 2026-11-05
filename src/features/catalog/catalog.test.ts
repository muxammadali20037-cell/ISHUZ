import { describe, expect, it } from "vitest";
import { CATALOG, CATALOG_SLOTS, categoryHref, tailSpan } from "./catalog";

describe("kasblar katalogi", () => {
  it("egasi bergan 14 soha, kalitlar va sohalar takrorlanmaydi", () => {
    expect(CATALOG).toHaveLength(14);
    expect(new Set(CATALOG.map((c) => c.key)).size).toBe(14);
    expect(new Set(CATALOG.map((c) => c.slug)).size).toBe(14);
    expect(CATALOG_SLOTS[0]).toBe("cat_construction");
  });

  it("soha havolasi — mavjud /jobs filtri", () => {
    expect(categoryHref("auto_service")).toBe("/jobs?category=auto_service");
  });

  it("'Boshqa kasblar' kartasi oxirgi qatorni to'ldiradi (2 · 3 · 4 ustun)", () => {
    // 6 ta surat: telefonda 3 qator + to'liq qator, planshetda 2 qator + to'liq qator, kompyuterda 4 + (2 + 2)
    expect(tailSpan(6)).toEqual({ cls: "col-span-2 md:col-span-3 lg:col-span-2", wide: { base: true, md: true, lg: true } });
    // 7 ta: 2 ustunda bitta joy qoladi, 3 ustunda 2, 4 ustunda 1
    expect(tailSpan(7)).toEqual({ cls: "col-span-1 md:col-span-2 lg:col-span-1", wide: { base: false, md: true, lg: false } });
    // surat yo'q — karta butun qator
    expect(tailSpan(0).cls).toBe("col-span-2 md:col-span-3 lg:col-span-4");
  });
});
