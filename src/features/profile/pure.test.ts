import { describe, expect, it } from "vitest";
import {
  ageFrom,
  checkAvatarFile,
  checkPortfolioFile,
  customSkillSlug,
  formatExperienceRange,
  formatMonthYear,
  formatYearRange,
  isoDateToMonth,
  mediaKind,
  monthToIsoDate,
  parseEmployerStats,
  reorderItems,
  resolveDark,
  suggestionLinks,
  themeFromCookie,
} from "./pure";

describe("suggestionLinks", () => {
  it("maps known suggestions to edit sections and drops unknown ones", () => {
    expect(suggestionLinks(["add_photo", "add_salary", "add_portfolio", "weird"])).toEqual([
      { key: "add_photo", href: "/profile/edit#personal" },
      { key: "add_salary", href: "/profile/edit#preferences" },
      { key: "add_portfolio", href: "/profile/portfolio" },
    ]);
  });
});

describe("dates", () => {
  it("formats month + year in uz and ru", () => {
    expect(formatMonthYear("2022-01-15", "uz")).toBe("Yanvar 2022");
    expect(formatMonthYear("2022-01-15", "ru")).toBe("Январь 2022");
    expect(formatMonthYear(null, "uz")).toBe("");
  });
  it("formats experience ranges with present label", () => {
    expect(formatExperienceRange("2022-01-01", null, true, "uz", "hozir")).toBe("Yanvar 2022 – hozir");
    expect(formatExperienceRange("2019-03-01", "2021-06-01", false, "uz", "hozir")).toBe("Mart 2019 – Iyun 2021");
  });
  it("formats year ranges", () => {
    expect(formatYearRange(2018, 2022)).toBe("2018 – 2022");
    expect(formatYearRange(2018, null)).toBe("2018 – …");
    expect(formatYearRange(null, 2022)).toBe("2022");
    expect(formatYearRange(2020, 2020)).toBe("2020");
  });
  it("converts month/year to iso and back", () => {
    expect(monthToIsoDate(2022, 3)).toBe("2022-03-01");
    expect(monthToIsoDate(2022, 13)).toBeNull();
    expect(isoDateToMonth("2022-03-01")).toEqual({ year: 2022, month: 3 });
    expect(isoDateToMonth(null)).toEqual({ year: null, month: null });
  });
  it("computes age", () => {
    expect(ageFrom("2000-06-15", new Date("2026-09-26"))).toBe(26);
    expect(ageFrom("2000-12-15", new Date("2026-09-26"))).toBe(25);
    expect(ageFrom(null)).toBeNull();
  });
});

describe("customSkillSlug", () => {
  it("builds a safe unique-ish slug", () => {
    expect(customSkillSlug("Kassa apparati", "abc12")).toBe("custom-kassa-apparati-abc12");
    expect(customSkillSlug("O'zbek tili!!", "x")).toBe("custom-ozbek-tili-x");
    expect(customSkillSlug("   ", "z")).toBe("custom-skill-z");
  });
});

describe("file checks", () => {
  it("validates avatar files", () => {
    expect(checkAvatarFile({ type: "image/png", size: 1000 })).toEqual({ ok: true, ext: "png" });
    expect(checkAvatarFile({ type: "image/gif", size: 1000 })).toEqual({ ok: false, error: "file_type" });
    expect(checkAvatarFile({ type: "image/jpeg", size: 4 * 1024 * 1024 })).toEqual({ ok: false, error: "file_too_large" });
  });
  it("validates portfolio files per type", () => {
    expect(checkPortfolioFile({ type: "application/pdf", size: 10 }, "pdf")).toEqual({ ok: true, ext: "pdf" });
    expect(checkPortfolioFile({ type: "application/pdf", size: 10 }, "image")).toEqual({ ok: false, error: "file_type" });
    expect(checkPortfolioFile({ type: "video/mp4", size: 30 * 1024 * 1024 }, "video")).toEqual({ ok: false, error: "file_too_large" });
  });
  it("detects media kind from path", () => {
    expect(mediaKind("u/1.JPG")).toBe("image");
    expect(mediaKind("u/1.mp4")).toBe("video");
    expect(mediaKind("u/1.pdf")).toBe("pdf");
    expect(mediaKind("u/1.docx")).toBe("document");
    expect(mediaKind("u/1")).toBe("other");
  });
});

describe("reorderItems", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("moves an item up and renumbers", () => {
    expect(reorderItems(items, "c", "up")).toEqual([
      { id: "a", sort_order: 0 },
      { id: "c", sort_order: 1 },
      { id: "b", sort_order: 2 },
    ]);
  });
  it("returns null at boundaries or for unknown id", () => {
    expect(reorderItems(items, "a", "up")).toBeNull();
    expect(reorderItems(items, "c", "down")).toBeNull();
    expect(reorderItems(items, "zzz", "down")).toBeNull();
  });
});

describe("theme", () => {
  it("parses cookie and resolves dark", () => {
    expect(themeFromCookie("dark")).toBe("dark");
    expect(themeFromCookie(undefined)).toBe("system");
    expect(resolveDark("system", true)).toBe(true);
    expect(resolveDark("light", true)).toBe(false);
    expect(resolveDark("dark", false)).toBe(true);
  });
});

describe("parseEmployerStats", () => {
  it("reads numbers and defaults to 0", () => {
    const s = parseEmployerStats({ active_vacancies: 3, applications: "7", views: null });
    expect(s.active_vacancies).toBe(3);
    expect(s.applications).toBe(7);
    expect(s.views).toBe(0);
    expect(s.hired).toBe(0);
    expect(parseEmployerStats(null).total_vacancies).toBe(0);
  });
});
