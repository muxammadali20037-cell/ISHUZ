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

  it("3 ta bo'lim: Chat · E'lonlarim · Profil (har rejimda)", () => {
    for (const mode of ["worker", "employer", null] as const) expect(appTabs(mode).map((i) => i.key)).toEqual(["chat", "my-listings", "profile"]);
  });
  const activeKey = (path: string, find: string | null = null) => appTabs("worker").filter((i) => i.match(path, find)).map((i) => i.key);
  it("«Sizga mos» va arizalar — E'lonlarim ichida", () => {
    expect(activeKey("/cabinet/matches")).toEqual(["my-listings"]);
    expect(appTabs("employer").filter((i) => i.match("/employer/applications", null)).map((i) => i.key)).toEqual(["my-listings"]);
  });
  it("chatdan ochiladigan ro'yxatlar va e'lonlar — Chat", () => {
    for (const [p, f] of [["/", null], ["/chat", null], ["/jobs", null], ["/search", "workers"], ["/listing/abc", null], ["/post/vacancy", null], ["/ai/post", null]] as const) {
      expect(activeKey(p, f), p).toEqual(["chat"]);
    }
  });
  it("hisob sahifalari — Profil", () => {
    for (const p of ["/cabinet", "/settings", "/notifications", "/billing", "/applications"]) expect(activeKey(p), p).toEqual(["profile"]);
  });
});
