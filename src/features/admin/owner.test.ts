import { describe, expect, it } from "vitest";
import { isOwnerPhone, parseOwnerPhones } from "./owner";

describe("parseOwnerPhones / isOwnerPhone", () => {
  it("turli yozilishlarni bitta formatga keltiradi, noto'g'rilarini tashlaydi", () => {
    expect(parseOwnerPhones("+998 90 123-45-67, 998911234567; 901112233\nxyz")).toEqual(["+998901234567", "+998911234567", "+998901112233"]);
    expect(parseOwnerPhones("")).toEqual([]);
    expect(parseOwnerPhones(undefined)).toEqual([]);
  });

  it("faqat tasdiqlangan raqam ro'yxatda bo'lsa — egasi", () => {
    const owners = parseOwnerPhones("+998901234567");
    expect(isOwnerPhone(owners, ["998901234567"])).toBe(true); // Supabase auth raqamni "+" siz saqlaydi
    expect(isOwnerPhone(owners, [null, "+998 90 123 45 67"])).toBe(true);
    expect(isOwnerPhone(owners, ["+998901234568"])).toBe(false);
    expect(isOwnerPhone([], ["+998901234567"])).toBe(false);
    expect(isOwnerPhone(owners, [])).toBe(false);
  });
});
