import { describe, expect, it } from "vitest";
import { normalizePhone, phoneInputChange, phoneInputValue } from "./index";

describe("phoneInputValue: telefon maydoniga yozilgan yoki joylangan raqam", () => {
  it("mahalliy raqam (+998 siz) — +998 qo'shiladi, '+90' (Turkiya) bo'lib qolmaydi", () => {
    expect(phoneInputValue("901234567")).toBe("+998 90 123 45 67");
    expect(phoneInputValue("90 123 45 67")).toBe("+998 90 123 45 67");
    expect(phoneInputValue("(90) 123-45-67")).toBe("+998 90 123 45 67");
    expect(normalizePhone(phoneInputValue("901234567"))).toBe("+998901234567");
  });

  it("to'liq raqam: 998… va +998… o'zgarmaydi", () => {
    expect(phoneInputValue("998901234567")).toBe("+998 90 123 45 67");
    expect(phoneInputValue("+998 (90) 123-45-67")).toBe("+998 90 123 45 67");
  });

  it("eski '8 90 …' ko'rinishi", () => {
    expect(phoneInputValue("8 90 123 45 67")).toBe("+998 90 123 45 67");
  });

  it("yozish davomida: tayyor '+998 ' ga raqam qo'shiladi", () => {
    expect(phoneInputValue("+998 9")).toBe("+998 9");
    expect(phoneInputValue("+998 90 12")).toBe("+998 90 12");
    // maydon tozalanib, birinchi raqam yozilsa ham mahalliy deb olinadi
    expect(phoneInputValue("9")).toBe("+998 9");
  });
});

describe("phoneInputChange: o'chirish va ustiga joylash farqlanadi", () => {
  it("backspace — formatlanmaydi (bo'shliq qayta paydo bo'lmaydi)", () => {
    expect(phoneInputChange("+998 90 ", "+998 90 1")).toBe("+998 90 ");
    expect(phoneInputChange("+998 90", "+998 90 ")).toBe("+998 90");
  });
  it("to'liq raqam ustiga qisqaroq ko'rinishda joylash — formatlanadi", () => {
    expect(phoneInputChange("90 123 45 67", "+998 90 123 45 67")).toBe("+998 90 123 45 67");
    expect(phoneInputChange("93 555 11 22", "+998 90 123 45 67")).toBe("+998 93 555 11 22");
  });
});
