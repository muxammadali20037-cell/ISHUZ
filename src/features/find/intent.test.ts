import { describe, expect, it } from "vitest";
import { detectIntent, professionCandidates, stripSuffix, withoutPlaceOnly } from "./intent";

describe("detectIntent", () => {
  it.each([
    ["Buxgalter kerak", "workers"],
    ["Toshkentda haydovchi kerak", "workers"],
    ["Нужен бухгалтер", "workers"],
    ["Требуется водитель", "workers"],
    ["Ищу бухгалтера", "workers"],
    ["Бухгалтер керак", "workers"],
    ["Ishchi kerak", "workers"],
    ["Buxgalterlik bo'yicha ish kerak", "jobs"],
    ["Buxgalterlik boʻyicha ish kerak", "jobs"],
    ["Ish kerak", "jobs"],
    ["Haydovchi ishi", "jobs"],
    ["Ищу работу бухгалтером", "jobs"],
    ["Работа водителем", "jobs"],
    ["Вакансии бухгалтер", "jobs"],
    ["Иш керак", "jobs"],
  ] as const)("%s → %s", (q, mode) => {
    expect(detectIntent(q)).toBe(mode);
  });

  it("aniqlab bo'lmasa — null (savol beriladi)", () => {
    expect(detectIntent("Buxgalter")).toBeNull();
    expect(detectIntent("бухгалтер")).toBeNull();
    expect(detectIntent("")).toBeNull();
  });
});

describe("professionCandidates", () => {
  it("maqsad so'zlarini tashlab, kasbni qoldiradi", () => {
    expect(professionCandidates("Buxgalter kerak")).toEqual(["buxgalter"]);
  });
  it("qo'shimchasiz shaklini ham beradi", () => {
    expect(professionCandidates("Buxgalterlik bo'yicha ish kerak")).toContain("buxgalter");
  });
  it("kirill → lotin", () => {
    expect(professionCandidates("Нужен бухгалтер")).toContain("buxgalter");
  });
  it("ruscha kelishikdagi so'z asl yozuvida ham", () => {
    expect(professionCandidates("Ищу работу водителем")).toEqual(expect.arrayContaining(["водителем", "водител"]));
    expect(professionCandidates("Ищу работу водителем")).not.toContain("работу");
  });
  it("ikki so'zli kasb", () => {
    expect(professionCandidates("bosh buxgalter kerak")).toEqual(expect.arrayContaining(["bosh buxgalter", "buxgalter"]));
  });
});

describe("stripSuffix", () => {
  it("lik / lar / da", () => {
    expect(stripSuffix("buxgalterlik")).toContain("buxgalter");
    expect(stripSuffix("haydovchilar")).toContain("haydovchi");
    expect(stripSuffix("toshkentda")).toContain("toshkent");
  });
  it("qisqa so'zlarni buzmaydi", () => {
    expect(stripSuffix("ota")).toEqual([]);
  });
});

describe("withoutPlaceOnly — hudud nomi kasb sifatida qidirilmaydi", () => {
  const SAM = ["Samarqand viloyati", "Самаркандская область"];
  it("faqat hudud so'zidan iborat bo'laklar tashlanadi (qo'shimchali, qo'shimchasiz, kirill, ruscha kelishik)", () => {
    expect(withoutPlaceOnly(professionCandidates("Samarqandda"), SAM)).toEqual([]);
    expect(withoutPlaceOnly(professionCandidates("Самарқандда"), SAM)).toEqual([]);
    expect(withoutPlaceOnly(professionCandidates("в Самарканде"), SAM)).toEqual([]);
    expect(withoutPlaceOnly(professionCandidates("Chilonzorda"), ["Toshkent shahri", "город Ташкент", "Chilonzor tumani", "Чиланзарский район"])).toEqual([]);
  });
  it("kasb so'zi qatnashgan bo'laklar qoladi", () => {
    const out = withoutPlaceOnly(professionCandidates("Samarqandda oshpaz"), SAM);
    expect(out).toContain("oshpaz");
    expect(out).toContain("samarqandda oshpaz");
    expect(out).not.toContain("samarqandda");
    expect(out).not.toContain("samarqand");
    expect(withoutPlaceOnly(professionCandidates("samarqand qog'ozi ustasi"), SAM)).toContain("samarqand qog'ozi ustasi");
  });
  it("hudud tushunilmagan bo'lsa — hech narsa o'zgarmaydi; o'xshash boshlanadigan kasb tashlanmaydi", () => {
    const c = professionCandidates("buxgalter");
    expect(withoutPlaceOnly(c, [])).toEqual(c);
    expect(withoutPlaceOnly(c, ["Buxoro viloyati", "Бухарская область"])).toContain("buxgalter");
  });
});
