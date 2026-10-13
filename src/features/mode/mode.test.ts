import { describe, expect, it } from "vitest";
import { findModeOf, modeOfFind, parseMode, resolveMode } from "./mode";

describe("rejim (ish izlovchi / ish beruvchi)", () => {
  it("faqat ikki qiymat qabul qilinadi", () => {
    expect(parseMode("worker")).toBe("worker");
    expect(parseMode("employer")).toBe("employer");
    expect(parseMode("admin")).toBeNull();
    expect(parseMode("")).toBeNull();
    expect(parseMode(undefined)).toBeNull();
  });

  it("qurilmadagi tanlov → profildagi faol rol → mavjud rollar", () => {
    expect(resolveMode({ activeRole: "employer", cookie: "worker", roles: ["worker"] })).toBe("worker");
    expect(resolveMode({ activeRole: "employer", cookie: null, roles: ["worker"] })).toBe("employer");
    expect(resolveMode({ activeRole: null, cookie: "employer", roles: ["worker"] })).toBe("employer");
    expect(resolveMode({ activeRole: null, cookie: null, roles: ["worker", "employer"] })).toBe("worker");
    expect(resolveMode({ activeRole: null, cookie: null, roles: ["employer"] })).toBe("employer");
    expect(resolveMode({ activeRole: "admin", cookie: "bad", roles: [] })).toBeNull();
    expect(resolveMode({})).toBeNull();
  });

  it("rejim ↔ qidiruv turi", () => {
    expect(findModeOf("worker")).toBe("jobs");
    expect(findModeOf("employer")).toBe("workers");
    expect(modeOfFind("jobs")).toBe("worker");
    expect(modeOfFind("workers")).toBe("employer");
  });
});
