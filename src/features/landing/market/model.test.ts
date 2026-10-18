import { describe, expect, it } from "vitest";
import { parseFindParams } from "@/features/find/params";
import { heroSearchHref, latestTabFind, latestTabHref, parseLatestTab, parseMarketCounts } from "./model";

const REGIONS = ["tashkent_city", "samarkand"];
const params = (href: string) => parseFindParams(Object.fromEntries(new URL(href, "http://x").searchParams));

describe("bosh sahifa qidiruv paneli → /search", () => {
  it("kasb + viloyat + kunlik ish + maosh — mavjud qidiruv parametrlari", () => {
    const href = heroSearchHref({ q: "  sotuvchi  ", region: "samarkand", type: "daily", salary: "5000000" }, REGIONS);
    const p = params(href);
    expect(href.startsWith("/search?")).toBe(true);
    expect(p).toMatchObject({ mode: "jobs", q: "sotuvchi", region: "samarkand", pay: "daily", salary: 5_000_000, any: false, schedule: null });
  });

  it("ish grafigi (5/2, smenali…) — schedule; kasb yozilmasa — barcha kasblar", () => {
    const p = params(heroSearchHref({ q: "", region: "all", type: "shift", salary: "" }, REGIONS));
    expect(p).toMatchObject({ mode: "jobs", q: "", any: true, region: "all", schedule: "shift", pay: null, salary: null });
  });

  it("hudud tanlanmagan — URL'da yo'q (matndan aniqlanadi yoki keyingi qadamda so'raladi); masofaviy — region=remote", () => {
    expect(params(heroSearchHref({ q: "haydovchi", region: "", type: "", salary: "" }, REGIONS)).region).toBeNull();
    expect(params(heroSearchHref({ q: "operator", region: "remote", type: "", salary: "" }, REGIONS)).region).toBe("remote");
  });

  it("noto'g'ri qiymatlar tashlanadi: begona viloyat, ro'yxatdan tashqari maosh va tur, juda uzun matn", () => {
    const p = params(heroSearchHref({ q: "x".repeat(300), region: "atlantis", type: "freelance", salary: "123" }, REGIONS));
    expect(p.region).toBeNull();
    expect(p.salary).toBeNull();
    expect(p.schedule).toBeNull();
    expect(p.pay).toBeNull();
    expect(p.q.length).toBeLessThanOrEqual(120);
  });

  it("bitta harfli matn kasb deb olinmaydi — barcha kasblar", () => {
    expect(params(heroSearchHref({ q: "a", region: "all", type: "", salary: "" }, REGIONS))).toMatchObject({ q: "", any: true });
  });
});

describe("'Yangi ishlar' filtrlari", () => {
  it("faqat ma'lum qiymatlar, qolgani — 'all'", () => {
    expect(parseLatestTab("daily")).toBe("daily");
    expect(parseLatestTab(["remote", "x"])).toBe("remote");
    expect(parseLatestTab("permanent")).toBe("all");
    expect(parseLatestTab(undefined)).toBe("all");
  });

  it("har filtr — mavjud qidiruv: kunlik (pay), masofaviy (region=remote), tajribasiz (noexp)", () => {
    expect(latestTabFind("daily").params).toMatchObject({ pay: "daily", region: "all" });
    expect(latestTabFind("remote")).toMatchObject({ remote: true, params: { region: "remote", any: true } });
    expect(latestTabFind("noexp").params).toMatchObject({ noexp: true, any: true });
    expect(latestTabFind("all").params).toMatchObject({ any: true, region: "all", pay: null, noexp: false });
    expect(latestTabHref("all")).toBe("/#yangi-ishlar");
    expect(latestTabHref("noexp")).toBe("/?ish=noexp#yangi-ishlar");
  });
});

describe("bazadagi sonlar (home_market_counts)", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  it("to'g'ri javob — sonlar; 0 va noto'g'ri kalitlar tashlanadi", () => {
    expect(parseMarketCounts({ categories: { [id]: 3, "22222222-2222-4222-8222-222222222222": 0, hack: 5 }, employers: 2 })).toEqual({ categories: { [id]: 3 }, employers: 2 });
  });
  it("shakli boshqacha — null (son ko'rsatilmaydi, soxta raqam yo'q)", () => {
    expect(parseMarketCounts(null)).toBeNull();
    expect(parseMarketCounts([])).toBeNull();
    expect(parseMarketCounts({ categories: [], employers: 1 })).toBeNull();
    expect(parseMarketCounts({ categories: {}, employers: -1 })).toBeNull();
    expect(parseMarketCounts({ categories: {}, employers: "x" })).toBeNull();
  });
});
