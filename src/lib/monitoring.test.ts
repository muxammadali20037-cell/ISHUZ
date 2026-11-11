import { describe, expect, it } from "vitest";
import { scrubEvent, scrubPersonalData } from "./monitoring";

describe("monitoring: shaxsiy ma'lumot yuborilmaydi", () => {
  it("telefon raqamlari turli yozuvda yashiriladi", () => {
    for (const p of ["+998901112233", "998 90 111 22 33", "+998 (90) 111-22-33"]) {
      expect(scrubPersonalData(`raqam ${p} topilmadi`)).toBe("raqam +998••••••••• topilmadi");
    }
  });
  it("e-mail yashiriladi", () => {
    expect(scrubPersonalData("owner a.b+c@mail.uz failed")).toBe("owner •••@••• failed");
  });
  it("hodisadan so'rov va foydalanuvchi olib tashlanadi, xabar tozalanadi", () => {
    const e = scrubEvent({ message: "tel +998901112233", exception: { values: [{ value: "x@y.uz" }] }, request: { headers: { cookie: "s" } }, user: { id: "1" } });
    expect(e).toEqual({ message: "tel +998•••••••••", exception: { values: [{ value: "•••@•••" }] } });
  });
});
