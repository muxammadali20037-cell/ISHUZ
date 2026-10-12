import { describe, expect, it } from "vitest";
import { clearEditedErrors } from "./field-errors";

type E = Partial<Record<"orgName" | "description" | "salary" | "form", string>>;
const FIELD_OF = { orgName: "orgName", description: "description", salaryFrom: "salary", salaryTo: "salary", negotiable: "salary" } as const;

describe("clearEditedErrors", () => {
  const errors: E = { orgName: "Nomini yozing", description: "Kamida 10 ta harf", salary: "Maoshni yozing", form: "Yuqoridagini tuzating" };

  it("tahrirlangan maydonning xatosi o'chadi, boshqalari qoladi", () => {
    expect(clearEditedErrors(errors, ["orgName"], FIELD_OF)).toEqual({ description: "Kamida 10 ta harf", salary: "Maoshni yozing", form: "Yuqoridagini tuzating" });
  });

  it("bir nechta kalit bitta xatoga (maosh dan/gacha)", () => {
    expect(clearEditedErrors(errors, ["salaryTo"], FIELD_OF).salary).toBeUndefined();
  });

  it("oxirgi maydon xatosi ketgach umumiy xabar ham o'chadi", () => {
    expect(clearEditedErrors({ description: "x", form: "y" }, ["description"], FIELD_OF)).toEqual({});
  });

  it("aloqasiz kalit (qadam) — o'sha obyekt qaytadi (keraksiz qayta chizish yo'q)", () => {
    expect(clearEditedErrors(errors, ["step"], FIELD_OF)).toBe(errors);
  });
});
