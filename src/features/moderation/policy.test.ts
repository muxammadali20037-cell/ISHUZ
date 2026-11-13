import { describe, expect, it } from "vitest";
import { banReason, isProhibitedProfession, shouldBan } from "./policy";

describe("jazo siyosati (ega, 2026-11-13)", () => {
  it("og'ir toifada rad etilsa — muallif bloklanadi", () => {
    for (const category of ["sexual_services", "extremism", "illegal_activity", "religious_propaganda"]) {
      expect(shouldBan({ decision: "reject", category })).toBe(true);
    }
  });
  it("shubha (review) yoki yengil toifa — faqat e'lon rad etiladi, muallif bloklanmaydi", () => {
    expect(shouldBan({ decision: "review", category: "sexual_services" })).toBe(false);
    for (const category of ["political_content", "spam", "unrelated", "uncertain", "job_related"]) {
      expect(shouldBan({ decision: "reject", category })).toBe(false);
    }
    expect(shouldBan({ decision: "reject", category: null })).toBe(false);
  });
  it("sabab admin uchun qisqa va xavfsiz", () => {
    expect(banReason("sexual_services", "rule_strict_massage")).toBe("auto_moderation:sexual_services:rule_strict_massage");
    expect(banReason("extremism", "a b<script>")).toBe("auto_moderation:extremism:a_b_script_");
  });
  it("taqiqlangan kasblar katalogda yashiriladi, oddiylari qoladi", () => {
    expect(isProhibitedProfession({ name_uz: "Massajchi", name_ru: "Массажист", name_en: "Massage therapist" })).toBe(true);
    expect(isProhibitedProfession({ name_uz: "Spa massajchi", name_ru: "Спа-массажист" })).toBe(true);
    expect(isProhibitedProfession({ name_uz: "Tay massaji ustasi", name_ru: "Мастер тайского массажа" })).toBe(true);
    for (const n of ["Oshpaz", "Sport murabbiyi", "Fizioterapevt", "Frontend dasturchi", "Narkolog"]) {
      expect(isProhibitedProfession({ name_uz: n, name_ru: n })).toBe(false);
    }
  });
});
