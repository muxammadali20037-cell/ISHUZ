import { describe, expect, it } from "vitest";
import { emptyDraft, nextStep, parseBirthDate, parseFullName, parseSalary, progress, toggle, type FlowContext } from "./cv-flow";

const ctx: FlowContext = { hasPhone: false, hasSkillOptions: true, hasDistricts: true, hasSubcategories: true };

describe("cv-flow", () => {
  it("savollar tartibi va keraksizlarini tashlab o'tish", () => {
    const d = { ...emptyDraft(), experience: "none" as const, category_slug: "sales" };
    expect(nextStep(null, d, ctx)).toBe("name");
    expect(nextStep("experience", d, ctx)).toBe("skills"); // tajriba yo'q → oldingi ish so'ralmaydi
    expect(nextStep("russian", d, ctx)).toBe("salary"); // savdo → ingliz tili so'ralmaydi
    expect(nextStep("about", d, { ...ctx, hasPhone: true })).toBeNull(); // telefon bor → tugadi
    expect(nextStep("category", d, { ...ctx, hasSubcategories: false })).toBe("region");
    const it = { ...d, experience: "2_3y" as const, category_slug: "it" };
    expect(nextStep("experience", it, ctx)).toBe("prev_job");
    expect(nextStep("russian", it, ctx)).toBe("english");
  });

  it("progress", () => {
    const d = { ...emptyDraft(), experience: "none" as const, category_slug: "sales" };
    expect(progress("name", d, ctx)).toEqual({ index: 1, total: 15 });
  });

  it("ism familiya", () => {
    expect(parseFullName("aziza  karimova")).toEqual({ first_name: "Aziza", last_name: "Karimova" });
    expect(parseFullName("Азиза Каримова")).toEqual({ first_name: "Азиза", last_name: "Каримова" });
    expect(parseFullName("O'tkir G'aniyev")).toEqual({ first_name: "O'tkir", last_name: "G'aniyev" });
    expect(parseFullName("Aziza")).toBeNull();
    expect(parseFullName("123 456")).toBeNull();
  });

  it("tug'ilgan sana", () => {
    const now = new Date("2026-09-28T00:00:00Z");
    expect(parseBirthDate("15.03.1998", now)).toBe("1998-03-15");
    expect(parseBirthDate("5/3/2000", now)).toBe("2000-03-05");
    expect(parseBirthDate("1998-03-15", now)).toBe("1998-03-15");
    expect(parseBirthDate("31.02.1998", now)).toBeNull();
    expect(parseBirthDate("01.01.2020", now)).toBeNull(); // 6 yosh
    expect(parseBirthDate("1998", now)).toBeNull();
  });

  it("maosh", () => {
    expect(parseSalary("5 mln")).toBe(5_000_000);
    expect(parseSalary("4,5 млн")).toBe(4_500_000);
    expect(parseSalary("5 000 000")).toBe(5_000_000);
    expect(parseSalary("800 ming")).toBe(800_000);
    expect(parseSalary("salom")).toBeNull();
    expect(parseSalary("50")).toBeNull();
  });

  it("toggle", () => {
    expect(toggle(["a"], "b")).toEqual(["a", "b"]);
    expect(toggle(["a", "b"], "a")).toEqual(["b"]);
  });
});
