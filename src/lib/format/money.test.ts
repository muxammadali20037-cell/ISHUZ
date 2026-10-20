import { describe, expect, it } from "vitest";
import { formatMoney, formatMoneyShort, formatSalaryRange, formatSalaryWithPeriod } from "./index";

describe("pul: valyuta har tilning o'z yozuvida", () => {
  it("formatMoney — uz/oz/ru/en", () => {
    expect(formatMoney(5_000_000, "uz")).toBe("5 000 000 so'm");
    // avval o'zbek kirillda lotincha "so'm" chiqardi: "5 000 000 so'm/ой"
    expect(formatMoney(5_000_000, "oz")).toBe("5 000 000 сўм");
    expect(formatMoney(5_000_000, "ru")).toBe("5 000 000 сум");
    expect(formatMoney(5_000_000, "en")).toBe("5 000 000 UZS");
    expect(formatMoney(5_000_000, "oz", { withCurrency: false })).toBe("5 000 000");
  });

  it("formatMoneyShort — kirillda 'млн'/'минг'", () => {
    expect(formatMoneyShort(4_500_000, "oz")).toBe("4.5 млн");
    expect(formatMoneyShort(800_000, "oz")).toBe("800 минг");
    expect(formatMoneyShort(800_000, "uz")).toBe("800 ming");
    expect(formatMoneyShort(800_000, "ru")).toBe("800 тыс.");
  });

  it("formatSalaryRange — faqat boshlang'ich maosh so'z oldida (common.labels.salary_from)", () => {
    const labels = { negotiable: "Келишилади", from: "камида", to: "кўпи билан" };
    expect(formatSalaryRange(4_000_000, null, "oz", labels)).toBe("камида 4 000 000 сўм");
    expect(formatSalaryRange(4_000_000, 6_000_000, "oz", labels)).toBe("4 000 000 – 6 000 000 сўм");
    expect(formatSalaryRange(null, null, "oz", labels)).toBe("Келишилади");
  });

  it("formatSalaryWithPeriod — davr bilan (Telegram va bot), 'kamida' saqlanadi, kelishiladigan — davrsiz", () => {
    const labels = { negotiable: "Kelishiladi", from: "kamida", to: "ko'pi bilan" };
    const suffix = (type: string) => ({ monthly: "/oy", daily: "/kun", hourly: "/soat", piecework: " · ishbay" })[type] ?? "";
    expect(formatSalaryWithPeriod({ from: 5_000_000, to: 7_000_000, type: "monthly" }, "uz", labels, suffix)).toBe("5 000 000 – 7 000 000 so'm/oy");
    // avval Telegram'da " 250 000 so'm" — "kamida" ham, "/kun" ham yo'q edi
    expect(formatSalaryWithPeriod({ from: 250_000, to: null, type: "daily" }, "uz", labels, suffix)).toBe("kamida 250 000 so'm/kun");
    expect(formatSalaryWithPeriod({ from: null, to: 30_000, type: "hourly" }, "uz", labels, suffix)).toBe("ko'pi bilan 30 000 so'm/soat");
    expect(formatSalaryWithPeriod({ from: 5_000_000, to: 7_000_000, type: "monthly", negotiable: true }, "uz", labels, suffix)).toBe("Kelishiladi");
    expect(formatSalaryWithPeriod({ from: null, to: null, type: "monthly" }, "uz", labels, suffix)).toBe("Kelishiladi");
    expect(formatSalaryWithPeriod({ from: 5_000_000, to: null, type: "negotiable" }, "uz", labels, suffix)).toBe("kamida 5 000 000 so'm");
    expect(formatSalaryWithPeriod({ from: 5_000_000, to: null, type: null }, "uz", labels, suffix)).toBe("kamida 5 000 000 so'm");
  });
});
