import { describe, expect, it } from "vitest";
import { parseFindParams, anyProfession } from "@/features/find/params";
import { employerQuickFilters, placeChooserHref, seekerFiltersHref, seekerQuickFilters } from "./quick-filters";

const params = (href: string) => parseFindParams(Object.fromEntries(new URL(href, "http://x").searchParams));

describe("bosh sahifa tez filtrlari", () => {
  it("hudud eslab qolinmagan — butun O'zbekiston, kasb so'ralmaydi", () => {
    const list = seekerQuickFilters({ region: null, district: null });
    // tartib — dizayn bo'yicha: Kunlik · Tajribasiz · Masofaviy · Talabalar uchun
    expect(list.map((x) => x.key)).toEqual(["daily", "noexp", "remote", "students"]);
    const f = Object.fromEntries(list.map((x) => [x.key, x.href]));
    expect(f.noexp).toBe("/search?mode=jobs&region=all&noexp=1&any=1");
    expect(f.daily).toBe("/search?mode=jobs&region=all&pay=daily");
    expect(f.remote).toBe("/search?mode=jobs&region=remote&any=1");
    expect(f.students).toBe("/students");
    for (const href of [f.noexp, f.daily, f.remote]) expect(anyProfession(params(href!))).toBe(true);
    expect(seekerFiltersHref({ region: null, district: null })).toBe("/search?mode=jobs&region=all&any=1");
  });

  it("eslab qolingan hudud va tuman saqlanadi; masofaviy — hududsiz", () => {
    const d = "11111111-1111-4111-8111-111111111111";
    const f = Object.fromEntries(seekerQuickFilters({ region: "tashkent_city", district: d }).map((x) => [x.key, x.href]));
    expect(params(f.noexp!)).toMatchObject({ mode: "jobs", region: "tashkent_city", district: d, noexp: true, any: true });
    expect(params(seekerFiltersHref({ region: "tashkent_city", district: d }))).toMatchObject({ mode: "jobs", region: "tashkent_city", district: d, any: true });
    expect(params(f.daily!)).toMatchObject({ region: "tashkent_city", district: d, pay: "daily" });
    expect(params(f.remote!)).toMatchObject({ region: "remote", district: null });
  });

  it("ish beruvchi: tajribali (hududda) va yaqin atrofda", () => {
    const f = Object.fromEntries(employerQuickFilters({ region: null, district: null }).map((x) => [x.key, x.href]));
    expect(f.experienced).toBe("/search?mode=workers&region=all&exp=1&any=1");
    expect(f.near).toBe("/search?mode=workers&near=1");
  });

  it("hudud tanlash — kasb so'ralmaydigan hudud qadami", () => {
    expect(placeChooserHref("jobs")).toBe("/search?mode=jobs&any=1");
    expect(placeChooserHref("workers")).toBe("/search?mode=workers&any=1");
  });
});
