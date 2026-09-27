import { describe, expect, it } from "vitest";
import { completeCompanyOnboardingSchema, employerDraftSchema, personSchema, updateCompanySchema } from "./schema";

/**
 * Forma client'da zodResolver bilan tekshiriladi ("" → null), keyin server action o'sha natijani qayta tekshiradi.
 * Sxema o'z natijasini qabul qilishi shart — aks holda bo'sh ixtiyoriy maydon bilan forma yuborilmaydi.
 */
function roundTrip<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: unknown } }, input: unknown): T {
  const first = schema.safeParse(input);
  expect(first.success, JSON.stringify(first.error)).toBe(true);
  const second = schema.safeParse(first.data);
  expect(second.success, JSON.stringify(second.error)).toBe(true);
  expect(second.data).toEqual(first.data);
  return second.data as T;
}

const emptyCompany = { name: "Yunusobod tumani 45-maktab", phone: "", telegram: "", website: "", instagram: "", address: "", regionId: "", districtId: "", industryCategoryId: "", about: "", size: "", tin: "" };

describe("employer sxemalari idempotent (client + server tekshiruvi)", () => {
  it("bo'sh ixtiyoriy maydonli kompaniya (davlat tashkiloti)", () => {
    const out = roundTrip(completeCompanyOnboardingSchema, { ...emptyCompany, employerType: "government" });
    expect(out).toMatchObject({ phone: null, regionId: null, size: null, tin: null, employerType: "government" });
  });
  it("to'ldirilgan kompaniya: normallashgan qiymatlar o'zgarmaydi", () => {
    const out = roundTrip(completeCompanyOnboardingSchema, {
      ...emptyCompany,
      phone: "90 111 22 33",
      telegram: "t.me/worklyn_hr",
      website: "maktab45.uz",
      instagram: "@maktab45",
      tin: "123 456 789",
      size: "11_50",
      employerType: "company",
    });
    expect(out).toMatchObject({ phone: "+998901112233", telegram: "@worklyn_hr", website: "https://maktab45.uz", instagram: "maktab45", tin: "123456789" });
  });
  it("kompaniya sozlamalari (update)", () => {
    roundTrip(updateCompanySchema, { ...emptyCompany, companyId: "3163b487-f265-499b-aa67-740288fd014d" });
  });
  it("oddiy shaxs va qoralama", () => {
    roundTrip(personSchema, { displayName: "Aziz", contactPhone: "", regionId: "", districtId: "", about: "" });
    roundTrip(employerDraftSchema, { displayName: "", contactPhone: "", regionId: "", districtId: "", about: "" });
  });
  it("null qiymatlar ham qabul qilinadi", () => {
    roundTrip(completeCompanyOnboardingSchema, { ...emptyCompany, address: null, about: null, tin: null, employerType: "individual_entrepreneur" });
  });
});
