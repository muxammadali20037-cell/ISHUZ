import { describe, expect, it } from "vitest";
import { masterListingSchema, masterRequestSchema, masterReviewSchema, masterSearchHref, parseMasterSearch, parseServices } from "./schema";

const OWNER = "7e2e0000-0000-4000-8000-000000000001";
const base = {
  id: null,
  categoryId: "11111111-1111-4111-8111-111111111111",
  displayName: "  Azizbek   usta ",
  title: "Konditsioner o'rnatish",
  description: "Split konditsionerlarni o'rnataman va tozalayman.",
  experienceYears: 7,
  services: ["o'rnatish", "tozalash"],
  regionId: null,
  districtId: null,
  serviceArea: null,
  phone: "+998901234567",
  phonePublic: false,
  priceNegotiable: true,
  priceFrom: null,
  priceTo: null,
  workFrom: "09:00",
  workTo: "22:00",
  photos: [`${OWNER}/v-${"a".repeat(64)}.webp`],
  submit: true,
};

describe("usta e'loni sxemasi", () => {
  it("to'g'ri e'lon o'tadi; ism va sarlavhadagi ortiqcha bo'shliqlar ixchamlanadi", () => {
    const r = masterListingSchema.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.success && r.data.displayName).toBe("Azizbek usta");
  });

  it("telefon faqat +998 va 9 raqam; rasm yo'li faqat karantin yoki tekshirilgan ko'rinishda", () => {
    expect(masterListingSchema.safeParse({ ...base, phone: "901234567" }).success).toBe(false);
    expect(masterListingSchema.safeParse({ ...base, phone: "+79001234567" }).success).toBe(false);
    expect(masterListingSchema.safeParse({ ...base, photos: ["https://evil.example/x.png"] }).success).toBe(false);
    expect(masterListingSchema.safeParse({ ...base, photos: ["../../etc/passwd"] }).success).toBe(false);
    expect(masterListingSchema.safeParse({ ...base, photos: Array.from({ length: 5 }, () => base.photos[0]!) }).success).toBe(false);
  });

  it("narx: kelishiladi yoki kamida bitta chegara; «gacha» «dan»dan kam emas", () => {
    expect(masterListingSchema.safeParse({ ...base, priceNegotiable: false }).success).toBe(false);
    expect(masterListingSchema.safeParse({ ...base, priceNegotiable: false, priceFrom: 100_000 }).success).toBe(true);
    expect(masterListingSchema.safeParse({ ...base, priceNegotiable: false, priceFrom: 300_000, priceTo: 100_000 }).success).toBe(false);
  });

  it("ish vaqti: ikkalasi yoki hech biri; soat formati HH:MM", () => {
    expect(masterListingSchema.safeParse({ ...base, workTo: null }).success).toBe(false);
    expect(masterListingSchema.safeParse({ ...base, workFrom: null, workTo: null }).success).toBe(true);
    expect(masterListingSchema.safeParse({ ...base, workFrom: "25:00" }).success).toBe(false);
  });

  it("qisqa sarlavha/tavsif, juda ko'p xizmat — rad etiladi", () => {
    expect(masterListingSchema.safeParse({ ...base, title: "ab" }).success).toBe(false);
    expect(masterListingSchema.safeParse({ ...base, description: "qisqa" }).success).toBe(false);
    expect(masterListingSchema.safeParse({ ...base, services: Array.from({ length: 13 }, (_, i) => `x${i}`) }).success).toBe(false);
  });
});

describe("so'rov va sharh", () => {
  it("so'rov: ism va O'zbekiston raqami shart; xabar ixtiyoriy va cheklangan", () => {
    const listingId = "22222222-2222-4222-8222-222222222222";
    expect(masterRequestSchema.safeParse({ listingId, name: "Ali", phone: "+998931112233" }).success).toBe(true);
    expect(masterRequestSchema.safeParse({ listingId, name: "A", phone: "+998931112233" }).success).toBe(false);
    expect(masterRequestSchema.safeParse({ listingId, name: "Ali", phone: "931112233" }).success).toBe(false);
    expect(masterRequestSchema.safeParse({ listingId, name: "Ali", phone: "+998931112233", message: "x".repeat(1001) }).success).toBe(false);
  });

  it("sharh: baho 1–5 butun son", () => {
    const listingId = "22222222-2222-4222-8222-222222222222";
    expect(masterReviewSchema.safeParse({ listingId, rating: 5 }).success).toBe(true);
    for (const rating of [0, 6, 4.5]) expect(masterReviewSchema.safeParse({ listingId, rating }).success).toBe(false);
  });
});

describe("qidiruv parametrlari", () => {
  it("noto'g'ri qiymatlar standartga qaytadi; uzun so'rov kesiladi", () => {
    const p = parseMasterSearch({ q: `  santexnik   ${"x".repeat(200)}`, k: "Bad Slug!", region: "../etc", exp: "7", sort: "drop table", page: "-5" });
    expect(p).toMatchObject({ category: "", region: "", exp: 0, sort: "new", page: 1 });
    expect(p.q.length).toBe(80);
    expect(parseMasterSearch({ k: ["ac", "plumber"], exp: "3", sort: "rating", page: "999" })).toMatchObject({ category: "ac", exp: 3, sort: "rating", page: 200 });
  });

  it("havola: faqat standartdan farq qiladigan parametrlar", () => {
    expect(masterSearchHref({})).toBe("/ustalar/qidiruv");
    expect(masterSearchHref({ category: "ac", sort: "new", page: 1 })).toBe("/ustalar/qidiruv?k=ac");
    expect(masterSearchHref({ q: "kran ta'miri", category: "plumber", region: "tashkent_city", exp: 5, sort: "experience", page: 2 })).toBe(
      "/ustalar/qidiruv?q=kran+ta%27miri&k=plumber&region=tashkent_city&exp=5&sort=experience&page=2",
    );
  });

  it("qo'shimcha xizmatlar: vergul/nuqta-vergul/qator bo'yicha, takrorsiz, 12 tagacha, har biri 40 belgigacha", () => {
    expect(parseServices("o'rnatish,  tozalash ;diagnostika\ntozalash,,")).toEqual(["o'rnatish", "tozalash", "diagnostika"]);
    expect(parseServices(Array.from({ length: 20 }, (_, i) => `xizmat ${i}`).join(","))).toHaveLength(12);
    expect(parseServices("x".repeat(100))[0]).toHaveLength(40);
  });
});
