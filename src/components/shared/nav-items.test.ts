import { describe, expect, it } from "vitest";
import { appSideItems, appTabs } from "./nav-items";

/**
 * Pastki menyu va yon menyu: istalgan sahifada ko'pi bilan BITTA bo'lim faol (ko'k) bo'ladi.
 * QA (2026-11-21): ish izlovchida "Sizga mos" (/cabinet/matches) ochilganda "Ishlar" ham yonib turardi.
 */
const PATHS: [string, string | null][] = [
  ["/cabinet/matches", null],
  ["/jobs", null],
  ["/jobs/xarita", null],
  ["/search", "jobs"],
  ["/search", "workers"],
  ["/chat", null],
  ["/ai/post", null],
  ["/post/vacancy", null],
  ["/cabinet/elonlar", null],
  ["/employer/applications", null],
  ["/employer/vacancies", null],
  ["/cabinet", null],
  ["/notifications", null],
  ["/listing/abc", null],
];

describe("menyu: bir vaqtda bitta faol bo'lim", () => {
  for (const mode of ["worker", "employer", null] as const) {
    it(`pastki menyu, rejim: ${mode ?? "tanlanmagan"}`, () => {
      for (const [path, find] of PATHS) {
        const active = appTabs(mode).filter((i) => i.match(path, find)).map((i) => i.key);
        expect(active.length, `${path} ${find ?? ""} → ${active.join(", ")}`).toBeLessThanOrEqual(1);
      }
    });
    it(`yon menyu, rejim: ${mode ?? "tanlanmagan"}`, () => {
      for (const [path, find] of PATHS) {
        const active = appSideItems(mode).filter((i) => i.match(path, find)).map((i) => i.key);
        expect(active.length, `${path} ${find ?? ""} → ${active.join(", ")}`).toBeLessThanOrEqual(1);
      }
    });
  }

  it("ish izlovchi: /cabinet/matches — faqat «Sizga mos»", () => {
    expect(appTabs("worker").filter((i) => i.match("/cabinet/matches", null)).map((i) => i.key)).toEqual(["matches"]);
  });
  it("rejim tanlanmagan: /cabinet/matches — «Ishlar» (alohida «Sizga mos» bo'limi yo'q)", () => {
    expect(appTabs(null).filter((i) => i.match("/cabinet/matches", null)).map((i) => i.key)).toEqual(["jobs"]);
  });
});
