import { describe, expect, it } from "vitest";
import { localeAlternates, withLang } from "./seo";

describe("seo", () => {
  it("withLang", () => {
    expect(withLang("/jobs", "uz")).toBe("/jobs");
    expect(withLang("/jobs", "ru")).toBe("/jobs?lang=ru");
    expect(withLang("/jobs?category=sales", "ru")).toBe("/jobs?category=sales&lang=ru");
  });
  it("localeAlternates", () => {
    expect(localeAlternates("/", "ru")).toEqual({ canonical: "/?lang=ru", languages: { uz: "/", ru: "/?lang=ru", "x-default": "/" } });
    expect(localeAlternates("/jobs/x", "uz").canonical).toBe("/jobs/x");
  });
});
