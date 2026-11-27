import { describe, expect, it } from "vitest";
import { lastDays, revenueReport, type RevenuePayment } from "./revenue";

// 2026-11-27 20:00 Toshkent (15:00 UTC)
const NOW = new Date("2026-11-27T15:00:00Z");
const pay = (over: Partial<RevenuePayment>): RevenuePayment => ({
  amount: 49_000,
  purpose: "vacancy_publish",
  provider: "payme",
  status: "paid",
  paid_at: "2026-11-27T10:00:00Z",
  cancelled_at: null,
  ...over,
});

describe("kunlik daromad hisoboti", () => {
  it("kunlar — Toshkent vaqti bo'yicha, bugun bilan, eskidan yangiga", () => {
    expect(lastDays(3, NOW)).toEqual(["2026-11-25", "2026-11-26", "2026-11-27"]);
    // UTC 20:30 — Toshkentda ertasi kun
    expect(lastDays(1, new Date("2026-11-27T20:30:00Z"))).toEqual(["2026-11-28"]);
  });

  it("Payme/Click tushumi to'langan kuni; hamyondan to'lov, kutilayotgan va xato — sanalmaydi", () => {
    const r = revenueReport(
      [
        pay({}),
        pay({ amount: 99_000, provider: "click", paid_at: "2026-11-26T08:00:00Z" }),
        pay({ amount: 100_000, purpose: "wallet_topup", provider: "click", paid_at: "2026-11-26T09:00:00Z" }),
        pay({ amount: 49_000, provider: "wallet" }),
        pay({ status: "pending", paid_at: null }),
        pay({ status: "failed" }),
      ],
      7,
      NOW,
    );
    expect(r.totals).toEqual({ revenue: 248_000, refunds: 0, net: 248_000, count: 3, average: 82_667, today: 49_000 });
    expect(r.days).toHaveLength(7);
    expect(r.days.find((d) => d.day === "2026-11-26")).toMatchObject({ revenue: 199_000, count: 2, byPurpose: { vacancy_publish: 99_000, wallet_topup: 100_000 } });
    expect(r.byPurpose).toEqual([
      { purpose: "vacancy_publish", amount: 148_000, count: 2 },
      { purpose: "wallet_topup", amount: 100_000, count: 1 },
    ]);
    expect(r.byProvider).toEqual([
      { provider: "click", amount: 199_000, count: 2 },
      { provider: "payme", amount: 49_000, count: 1 },
    ]);
  });

  it("Toshkentda yarim tundan keyin to'langan — ertasi kunga", () => {
    const r = revenueReport([pay({ paid_at: "2026-11-26T19:30:00Z" })], 3, NOW);
    expect(r.days.find((d) => d.day === "2026-11-27")!.revenue).toBe(49_000);
  });

  it("qaytarilgan to'lov: to'langan kuni tushum, qaytarilgan kuni ayriladi; sof = tushum − qaytarilgan", () => {
    const r = revenueReport([pay({ status: "cancelled", paid_at: "2026-11-25T10:00:00Z", cancelled_at: "2026-11-27T09:00:00Z" })], 7, NOW);
    expect(r.days.find((d) => d.day === "2026-11-25")!.revenue).toBe(49_000);
    expect(r.days.find((d) => d.day === "2026-11-27")!.refunds).toBe(49_000);
    expect(r.totals).toMatchObject({ revenue: 49_000, refunds: 49_000, net: 0, today: -49_000 });
  });

  it("oraliqdan tashqaridagi to'lov va bekor qilingan (to'lanmagan) — sanalmaydi", () => {
    const r = revenueReport(
      [pay({ paid_at: "2026-10-01T10:00:00Z" }), pay({ status: "cancelled", paid_at: null, cancelled_at: "2026-11-27T09:00:00Z" })],
      7,
      NOW,
    );
    expect(r.totals).toMatchObject({ revenue: 0, refunds: 0, count: 0, average: 0 });
    expect(r.byPurpose).toEqual([]);
  });
});
