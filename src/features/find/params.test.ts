import { describe, expect, it } from "vitest";
import { EMPTY_FIND, activeFilterCount, findHref, parseFindParams } from "./params";

const ID = "11111111-2222-4333-8444-555555555555";

describe("parseFindParams", () => {
  it("noto'g'ri qiymatlarni tashlab yuboradi", () => {
    const p = parseFindParams({ mode: "x", p: "abc", region: "<script>", district: "zzz", page: "-5", salary: "abc", schedule: "evil" });
    expect(p).toEqual({ ...EMPTY_FIND });
  });
  it("to'g'ri qiymatlar", () => {
    const p = parseFindParams({ mode: "jobs", p: ID, region: "tashkent_city", district: "all", page: "3", salary: "5 000 000", schedule: "5_2", noexp: "1" });
    expect(p).toMatchObject({ mode: "jobs", p: ID, region: "tashkent_city", district: "all", page: 3, salary: 5000000, schedule: "5_2", noexp: true });
  });
});

describe("findHref", () => {
  it("qadamlar tartibida URL", () => {
    expect(findHref(EMPTY_FIND, { mode: "workers", p: ID })).toBe(`/search?mode=workers&p=${ID}`);
    expect(findHref(EMPTY_FIND, { mode: "workers", p: ID, region: "tashkent_city", district: "all" })).toBe(`/search?mode=workers&p=${ID}&region=tashkent_city&district=all`);
  });
  it("butun O'zbekiston / masofadan — tuman qo'shilmaydi", () => {
    expect(findHref(EMPTY_FIND, { mode: "jobs", p: ID, region: "all", district: ID })).toBe(`/search?mode=jobs&p=${ID}&region=all`);
  });
  it("ish rejimidagi filtrlar ishchi rejimiga o'tmaydi", () => {
    const jobs = { ...EMPTY_FIND, mode: "jobs" as const, p: ID, salary: 3000000, noexp: true };
    expect(findHref(jobs, { mode: "workers" })).toBe(`/search?mode=workers&p=${ID}`);
    expect(activeFilterCount(jobs)).toBe(2);
  });
  it("matn kasb tanlangach olib tashlanadi", () => {
    expect(findHref({ ...EMPTY_FIND, q: "buxgalter" }, { mode: "jobs" })).toBe("/search?mode=jobs&q=buxgalter");
    expect(findHref({ ...EMPTY_FIND, q: "buxgalter" }, { mode: "jobs", p: ID })).toBe(`/search?mode=jobs&p=${ID}`);
  });
});
