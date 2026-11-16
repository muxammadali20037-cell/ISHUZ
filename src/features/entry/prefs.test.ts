import { describe, expect, it } from "vitest";
import { EMPTY_PREFS, MAX_PREF_PROFESSIONS, cleanProfessionIds, formatPrefs, parsePrefs } from "./prefs";

const A = "0b9c8a3e-1f2d-4c5b-9a8e-7d6c5b4a3f21";
const B = "1c9c8a3e-1f2d-4c5b-9a8e-7d6c5b4a3f22";

describe("ish qidiruvchi tanlovi (cookie)", () => {
  it("yozib, qayta o'qiladi", () => {
    const p = { professions: [A, B], remote: true, experience: "1_2y" as const };
    expect(formatPrefs(p)).toBe(`${A}.${B}~1~1_2y`);
    expect(parsePrefs(formatPrefs(p))).toEqual(p);
  });

  it("bo'sh yoki buzilgan qiymat — bo'sh tanlov", () => {
    expect(parsePrefs(undefined)).toEqual(EMPTY_PREFS);
    expect(parsePrefs("")).toEqual(EMPTY_PREFS);
    expect(parsePrefs("x.y~2~zzz")).toEqual(EMPTY_PREFS);
    expect(parsePrefs("a".repeat(500))).toEqual(EMPTY_PREFS);
    expect(parsePrefs(`~0~-`)).toEqual(EMPTY_PREFS);
  });

  it("kasblar: faqat uuid, takrorsiz, 5 tagacha", () => {
    const many = Array.from({ length: 8 }, (_, i) => `${i}b9c8a3e-1f2d-4c5b-9a8e-7d6c5b4a3f21`);
    expect(cleanProfessionIds([A, A.toUpperCase(), "nope", 5, B])).toEqual([A, B]);
    expect(cleanProfessionIds(many)).toHaveLength(MAX_PREF_PROFESSIONS);
  });
});
