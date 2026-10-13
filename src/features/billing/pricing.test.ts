import { describe, expect, it } from "vitest";
import { orderProviders, parseAmount, perDay, rowStatus, topupBonus } from "./pricing";

describe("perDay — to'lov oynasidagi 'kuniga ... so'm'", () => {
  it("narx / kun, 100 so'mgacha yaxlitlab", () => {
    expect(perDay(50_000, 10)).toBe(5_000);
    expect(perDay(5_000, 10)).toBe(500);
    expect(perDay(15_000, 30)).toBe(500);
    expect(perDay(25_000, 10)).toBe(2_500);
    expect(perDay(10_000, 3)).toBe(3_300);
  });
  it("1 kunlik, kunsiz yoki bepul — ko'rsatilmaydi", () => {
    expect(perDay(20_000, 1)).toBeNull();
    expect(perDay(20_000, null)).toBeNull();
    expect(perDay(0, 10)).toBeNull();
  });
  it("juda arzon bo'lsa ham kamida 100 so'm", () => {
    expect(perDay(500, 30)).toBe(100);
  });
});

describe("orderProviders — oxirgi ishlatilgan usul birinchi", () => {
  it("oxirgisi bor bo'lsa — oldinga", () => {
    expect(orderProviders(["payme", "click"], "click")).toEqual(["click", "payme"]);
    expect(orderProviders(["payme", "click"], "payme")).toEqual(["payme", "click"]);
  });
  it("noma'lum yoki ulanmagan usul — tartib o'zgarmaydi", () => {
    expect(orderProviders(["payme", "click"], null)).toEqual(["payme", "click"]);
    expect(orderProviders(["payme"], "click")).toEqual(["payme"]);
    expect(orderProviders(["payme", "click"], "uzcard")).toEqual(["payme", "click"]);
  });
});

describe("topupBonus — serverdagi qoida bilan bir xil", () => {
  it("chegaradan kam — bonus yo'q; teng yoki ko'p — foiz", () => {
    expect(topupBonus(50_000, 10, 100_000)).toBe(0);
    expect(topupBonus(100_000, 10, 100_000)).toBe(10_000);
    expect(topupBonus(150_000, 10, 100_000)).toBe(15_000);
  });
  it("foiz 0 — bonus yo'q; 50 dan katta — 50", () => {
    expect(topupBonus(200_000, 0, 100_000)).toBe(0);
    expect(topupBonus(200_000, 80, 100_000)).toBe(100_000);
  });
});

describe("parseAmount — yozilgan summa", () => {
  it("bo'sh joy, so'm va boshqa belgilar e'tiborsiz", () => {
    expect(parseAmount("50 000")).toBe(50_000);
    expect(parseAmount("75000 so'm")).toBe(75_000);
    expect(parseAmount("1 000 000")).toBe(1_000_000);
  });
  it("raqam yo'q, 0 yoki juda uzun — null", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("12345678901")).toBeNull();
  });
});

describe("rowStatus — to'lovlar tarixidagi holat", () => {
  const now = Date.parse("2026-10-13T12:00:00Z");
  it("yangi kutilayotgan — kutilmoqda; 1 soatdan eski — to'lanmagan", () => {
    expect(rowStatus("pending", "2026-10-13T11:30:00Z", now)).toBe("pending");
    expect(rowStatus("pending", "2026-10-13T10:30:00Z", now)).toBe("unpaid");
  });
  it("qolganlari o'zgarmaydi", () => {
    expect(rowStatus("paid", "2026-10-01T00:00:00Z", now)).toBe("paid");
    expect(rowStatus("cancelled", "2026-10-01T00:00:00Z", now)).toBe("cancelled");
    expect(rowStatus("failed", "2026-10-01T00:00:00Z", now)).toBe("failed");
  });
});
