import { describe, expect, it } from "vitest";
import { distinctVisitors, isReportTime, paymentKpis, perVacancy, weekRange, weeklyDedupeKey, type PaidRow } from "./weekly";

describe("haftalik raqamlar", () => {
  it("hafta — dushanba 00:00 dan dushanba 00:00 gacha, Toshkent vaqti", () => {
    // 2026-11-28 shanba 20:00 Toshkent
    const now = new Date("2026-11-28T15:00:00Z");
    expect(weekRange(now, 0)).toEqual({ from: "2026-11-22T19:00:00.000Z", to: "2026-11-29T19:00:00.000Z", firstDay: "2026-11-23", lastDay: "2026-11-29" });
    expect(weekRange(now, 1)).toMatchObject({ firstDay: "2026-11-16", lastDay: "2026-11-22", to: "2026-11-22T19:00:00.000Z" });
    // dushanba 00:30 Toshkent (yakshanba 19:30 UTC) — yangi hafta boshlangan
    expect(weekRange(new Date("2026-11-29T19:30:00Z"), 1).firstDay).toBe("2026-11-23");
  });

  it("hisobot payti: dushanba 09:00 dan (Toshkent)", () => {
    expect(isReportTime(new Date("2026-11-30T03:59:00Z"))).toBe(false); // dushanba 08:59
    expect(isReportTime(new Date("2026-11-30T04:00:00Z"))).toBe(true); // dushanba 09:00
    expect(isReportTime(new Date("2026-12-01T04:00:00Z"))).toBe(false); // seshanba
  });

  it("takror yubormaslik kaliti — admin va hafta bo'yicha", () => {
    const r = weekRange(new Date("2026-11-30T05:00:00Z"), 1);
    expect(weeklyDedupeKey("p1", r)).toBe("weekly:p1:2026-11-23");
  });

  it("bir vakansiyaga arizalar", () => {
    expect(perVacancy({ applications: 12, activeVacancies: 30 })).toBe(0.4);
    expect(perVacancy({ applications: 5, activeVacancies: 0 })).toBe(0);
  });

  it("noyob tashrifchilar: profil yoki anonim identifikator, bo'shlar sanalmaydi", () => {
    expect(distinctVisitors([{ profile_id: "p1", anon_id: "a1" }, { profile_id: "p1", anon_id: null }, { profile_id: null, anon_id: "a1" }, { profile_id: null, anon_id: null }])).toBe(2);
  });

  it("to'lovlar: TOP oluvchilar, qayta oluvchilar, sof tushum (hamyon va hafta tashqarisi sanalmaydi, qaytarilgani ayriladi)", () => {
    const range = weekRange(new Date("2026-11-30T05:00:00Z"), 1); // 23–29 noyabr
    const at = "2026-11-25T10:00:00Z";
    const rows: PaidRow[] = [
      { profile_id: "e1", amount: 49_000, plan: "boost", provider: "payme", status: "paid", paid_at: at, cancelled_at: null },
      { profile_id: "e1", amount: 30_000, plan: "basic", provider: "wallet", status: "paid", paid_at: at, cancelled_at: null },
      { profile_id: "e2", amount: 99_000, plan: "max", provider: "click", status: "paid", paid_at: at, cancelled_at: null },
      { profile_id: "e3", amount: 30_000, plan: "basic", provider: "click", status: "paid", paid_at: "2026-11-10T10:00:00Z", cancelled_at: null },
      { profile_id: "e4", amount: 20_000, plan: "basic", provider: "payme", status: "cancelled", paid_at: "2026-11-10T10:00:00Z", cancelled_at: at },
    ];
    const counts = new Map([["e1", 3], ["e2", 1], ["e3", 1]]);
    expect(paymentKpis(rows, range, counts)).toEqual({ topBuyers: 2, repeatBuyers: 1, revenue: 49_000 + 99_000 - 20_000 });
  });
});
