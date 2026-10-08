import { describe, expect, it } from "vitest";
import { introducesNumbers, keepSalary, mentionedAmounts, mentionedInText, mentionsExperience, mentionsSchedule } from "./ai-guard";

describe("AI natijasi faqat matnga asoslangan bo'lsin", () => {
  it("summalar ajratiladi", () => {
    expect(mentionedAmounts("5–7 million")).toEqual(expect.arrayContaining([5_000_000, 7_000_000]));
    expect(mentionedAmounts("6 milliondan ish qidiryapman")).toContain(6_000_000);
    expect(mentionedAmounts("oylik 500 ming")).toContain(500_000);
    expect(mentionedAmounts("Зарплата 5 000 000 сум")).toContain(5_000_000);
    expect(mentionedAmounts("от 3 млн")).toContain(3_000_000);
  });
  it("matnda aytilmagan maosh olib tashlanadi", () => {
    expect(keepSalary(6_000_000, "Men buxgalterman, 6 milliondan ish qidiryapman")).toBe(6_000_000);
    expect(keepSalary(8_000_000, "Men buxgalterman, 6 milliondan ish qidiryapman")).toBeNull();
    expect(keepSalary(5_000_000, "Oshpaz kerak, tajribali bo'lsin")).toBeNull();
  });
  it("tajriba va jadval — faqat aytilgan bo'lsa", () => {
    expect(mentionsExperience("3 yil tajribam bor")).toBe(true);
    expect(mentionsExperience("tajribali bo'lsin")).toBe(true);
    expect(mentionsExperience("Chilonzorda buxgalter")).toBe(false);
    expect(mentionsSchedule("6 kunlik ish")).toBe(true);
    expect(mentionsSchedule("2/2 grafik")).toBe(true);
    expect(mentionsSchedule("oshpaz kerak")).toBe(false);
  });
  it("ism va tashkilot nomi matnda bo'lishi kerak", () => {
    expect(mentionedInText("Ali", "Men Ali, buxgalterman")).toBe("Ali");
    expect(mentionedInText("Aziz", "Men buxgalterman")).toBeNull();
    expect(mentionedInText("Safia kafe", "Safia kafesiga oshpaz kerak")).toBe("Safia kafe");
  });
  it("tavsifga yangi raqam qo'shilsa — aniqlanadi", () => {
    expect(introducesNumbers("3 yillik tajribaga ega buxgalter", "buxgalterman, 3 yil tajribam bor")).toBe(false);
    expect(introducesNumbers("5 yillik tajriba, 2 ta diplom", "buxgalterman, 3 yil tajribam bor")).toBe(true);
  });
});
