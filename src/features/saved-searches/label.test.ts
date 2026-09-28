import { describe, expect, it } from "vitest";
import { DEFAULT_JOBS_PARAMS } from "@/features/jobs/search-params";
import { savedSearchLabel } from "./label";

const refs = {
  categories: [{ slug: "restaurant", name_uz: "Restoran", name_ru: "Ресторан" }],
  subcategories: [{ slug: "cook", name_uz: "Oshpaz", name_ru: "Повар" }],
  regions: [{ slug: "tashkent_city", name_uz: "Toshkent shahri", name_ru: "Ташкент" }],
  districts: [
    { id: "d1", name_uz: "Chilonzor", name_ru: "Чиланзар" },
    { id: "d2", name_uz: "Yunusobod", name_ru: "Юнусабад" },
    { id: "d3", name_uz: "Sergeli", name_ru: "Сергели" },
  ],
};
const words = { salaryFrom: (a: string) => `${a} dan`, remote: "Masofaviy", noExperience: "Tajribasiz" };

describe("savedSearchLabel", () => {
  it("kasb · tumanlar · maosh", () => {
    const p = { ...DEFAULT_JOBS_PARAMS, category: "restaurant", subcategory: "cook", region: "tashkent_city", district: ["d1", "d2", "d3"], salaryMin: 5_500_000 };
    expect(savedSearchLabel(p, refs, "uz", words)).toBe("Oshpaz · Chilonzor, Yunusobod +1 · 5,5 mln dan");
  });
  it("ruscha, faqat so'z va hudud", () => {
    const p = { ...DEFAULT_JOBS_PARAMS, q: "Anor", region: "tashkent_city", salaryMin: 300_000 };
    expect(savedSearchLabel(p, refs, "ru", words)).toBe("«Anor» · Ташкент · 300 тыс dan");
  });
});
