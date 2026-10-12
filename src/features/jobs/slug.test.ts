import { describe, expect, it } from "vitest";
import { normalizeVacancySlug } from "./slug";

describe("normalizeVacancySlug (public.slugify bilan bir xil alifbo)", () => {
  it("lotin va kirill (ruscha, o'zbekcha) slug qabul qilinadi", () => {
    expect(normalizeVacancySlug("buxgalter-toshkent-shahri-326b0f")).toBe("buxgalter-toshkent-shahri-326b0f");
    expect(normalizeVacancySlug("бухгалтер-ташкент-048f09")).toBe("бухгалтер-ташкент-048f09");
    expect(normalizeVacancySlug("ҳайдовчи-қарши-1a2b3c")).toBe("ҳайдовчи-қарши-1a2b3c");
  });
  it("URL-kodlangan ko'rinish ham", () => {
    expect(normalizeVacancySlug(encodeURIComponent("бухгалтер-ташкент-048f09"))).toBe("бухгалтер-ташкент-048f09");
  });
  it("boshqa belgilar va buzilgan kodlash — rad", () => {
    expect(normalizeVacancySlug("a'; drop table--")).toBeNull();
    expect(normalizeVacancySlug("%E0%A4%A")).toBeNull();
    expect(normalizeVacancySlug("ab")).toBeNull();
  });
});
