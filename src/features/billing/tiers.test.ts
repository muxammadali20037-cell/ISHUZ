import { describe, expect, it } from "vitest";
import { parseTiers, selectableTiers } from "./tiers";

const raw = [
  { plan: "basic", price: 15000, full_price: 30000, days: 10, top_days: 0, ai_days: 0 },
  { plan: "boost", price: 24500, full_price: 49000, days: 15, top_days: 3, ai_days: 0 },
  { plan: "max", price: 49500, full_price: 99000, days: 30, top_days: 10, ai_days: 0 },
];

describe("tarif darajalari", () => {
  it("server javobi: uch daraja tartib bilan; buzuq yoki to'liq bo'lmasa — eski oqim (null)", () => {
    expect(parseTiers(raw)?.map((t) => [t.plan, t.price, t.fullPrice, t.topDays])).toEqual([
      ["basic", 15000, 30000, 0],
      ["boost", 24500, 49000, 3],
      ["max", 49500, 99000, 10],
    ]);
    expect(parseTiers(null)).toBeNull();
    expect(parseTiers(raw.slice(0, 2))).toBeNull();
    expect(parseTiers([raw[1], raw[0], raw[2]])).toBeNull();
    expect(parseTiers([{ ...raw[0], plan: "gold" }, raw[1], raw[2]])).toBeNull();
    expect(parseTiers([{ ...raw[0], price: "15000" }, raw[1], raw[2]])).toBeNull();
  });

  it("to'lov kerak — uchala daraja; bepul/faol e'lon — faqat kuchaytirish (Tezkor, Maksimal) va faqat so'ralganda", () => {
    const tiers = parseTiers(raw);
    expect(selectableTiers(tiers, "payment_required", false).map((t) => t.plan)).toEqual(["basic", "boost", "max"]);
    expect(selectableTiers(tiers, "paid_window", true).map((t) => t.plan)).toEqual(["boost", "max"]);
    expect(selectableTiers(tiers, "free", false)).toEqual([]);
    expect(selectableTiers(null, "payment_required", false)).toEqual([]);
  });
});
