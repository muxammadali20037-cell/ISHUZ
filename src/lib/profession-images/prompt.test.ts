import { describe, expect, it } from "vitest";
import { buildProfessionPrompt, professionAndSpecialization, PROFESSION_IMAGE_TEMPLATE } from "./prompt";

describe("buildProfessionPrompt", () => {
  it("shablonga kasb va mutaxassislikni qo'yadi", () => {
    const p = buildProfessionPrompt("Welder", "Argon welding");
    expect(p).toContain("occupation illustration for Welder, specialization Argon welding.");
    expect(p).toContain("No text, letters, numbers, logos, watermarks");
    expect(p).not.toContain("{");
  });
  it("matndagi ortiqcha belgilarni tozalaydi", () => {
    expect(buildProfessionPrompt("Ac{count}ant\n", "")).toContain("for Ac count ant, specialization Ac count ant.");
  });
  it("shablon o'zgarmagan", () => {
    expect(PROFESSION_IMAGE_TEMPLATE.startsWith("Create a professional, realistic occupation illustration")).toBe(true);
  });
});

describe("professionAndSpecialization", () => {
  const node = (kind: string, name_en: string | null, name_ru = "ru", name_uz = "uz") => ({ kind, name_en, name_ru, name_uz });
  it("mutaxassislik — eng yaqin kasb tuguni + o'zi", () => {
    expect(professionAndSpecialization([node("group", "Medicine"), node("profession", "Doctor"), node("specialization", "Cardiologist")])).toEqual({
      profession: "Doctor",
      specialization: "Cardiologist",
    });
  });
  it("kasbning o'zi tanlangan bo'lsa — uning guruhi", () => {
    expect(professionAndSpecialization([node("group", "Accounting"), node("profession", "Accountant")])).toEqual({ profession: "Accountant", specialization: "Accounting" });
  });
  it("ildizdagi kasb — o'zi", () => {
    expect(professionAndSpecialization([node("profession", "Driver")])).toEqual({ profession: "Driver", specialization: "Driver" });
  });
  it("ingliz nomi bo'lmasa — ruscha", () => {
    expect(professionAndSpecialization([node("profession", null, "Бухгалтер")])?.profession).toBe("Бухгалтер");
  });
  it("bo'sh yo'l", () => {
    expect(professionAndSpecialization([])).toBeNull();
  });
});
