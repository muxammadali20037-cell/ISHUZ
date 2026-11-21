import { describe, expect, it } from "vitest";
import { detectIntent, detectPostIntent, postTopic, professionCandidates, stripSuffix, withoutPlaceOnly } from "./intent";

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
    // 2026-11-21: AI rolni o'zi aniqlaydi (master prompt misollari)
    ["Men ish qidiryapman", "jobs"],
    ["Menga ish kerak", "jobs"],
    ["Men haydovchiman", "jobs"],
    ["Men elektrikman", "jobs"],
    ["Мен электрикман", "jobs"],
    ["Samarqandda sotuvchi bo'lib ishlamoqchiman", "jobs"],
    ["Я водитель", "jobs"],
    ["Menga farrosh kerak", "workers"],
    ["2 ta quruvchi kerak", "workers"],
    ["Toshkentdan elektrik qidiryapman", "workers"],
    ["Menga Toshkent shahridan 2 ta elektrik kerak. Tajribali bo'lsin.", "workers"],
  ] as const)("%s → %s", (q, mode) => {
    expect(detectIntent(q)).toBe(mode);
  });

  it("aniqlab bo'lmasa — null (savol beriladi)", () => {
    expect(detectIntent("Buxgalter")).toBeNull();
    expect(detectIntent("elektrik")).toBeNull();
    expect(detectIntent("Toshkent oshpaz")).toBeNull();
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
  it("olmosh va kesim: \"men instruktorman\" — \"men\" kasb emas, \"instruktor\" qidiriladi", () => {
    const c = professionCandidates("men instruktorman menga ish kerak");
    expect(c).toContain("instruktor");
    expect(c).not.toContain("men");
    expect(c).not.toContain("menga");
  });
  it("kirillcha: \"мен ўқитувчиман\" — \"мен\" (менеджер) emas, \"ўқитувчи\" qidiriladi", () => {
    const c = professionCandidates("мен ўқитувчиман");
    expect(c).not.toContain("мен");
    expect(c).toContain("ўқитувчи");
    expect(c).toContain("o'qituvchi");
  });
  it("ikki so'zli kasb", () => {
    expect(professionCandidates("bosh buxgalter kerak")).toEqual(expect.arrayContaining(["bosh buxgalter", "buxgalter"]));
  });
  it("uzun gap: kasb so'zi juftlar orasida kesilib qolmaydi, to'ldiruvchi so'zlar (tajriba, maosh, vaqt) tashlanadi", () => {
    const c = professionCandidates(
      "Toshkentda sotuvchi ish kerak, tajribam 2 yil, oylik kamida 4 million, Chilonzor yoki Yunusobod tumani bo'lsa yaxshi, haftasiga 5 kun ishlamoqchiman",
    );
    expect(c).toContain("sotuvchi");
    for (const w of ["tajribam", "kamida", "million", "haftasiga", "tumani", "bo'lsa"]) expect(c.join(" ")).not.toContain(w);
    expect(c.length).toBeLessThanOrEqual(14);
  });
  it("uzun ruscha gap: kasb so'zi (asl yozuvida ham) ro'yxatda", () => {
    const c = professionCandidates("Ищу работу продавцом в Ташкенте, опыт 2 года, зарплата от 4 млн, Чиланзар или Юнусабад, график 5/2");
    expect(c).toEqual(expect.arrayContaining(["prodavtsom", "продавцом"]));
    expect(c).not.toContain("opit");
    expect(c).not.toContain("zarplata");
  });
  it("uzun gapda ham ikki so'zli kasb qoladi", () => {
    const c = professionCandidates("Menga Toshkentda yuk mashinasi haydovchisi sifatida ish kerak, tajribam 5 yil");
    expect(c).toEqual(expect.arrayContaining(["haydovchisi", "yuk mashinasi"]));
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

describe("detectPostIntent", () => {
  it("e'lon berish niyati va kim uchun", () => {
    expect(detectPostIntent("Vakansiya joylamoqchiman")).toEqual({ who: "employer" });
    expect(detectPostIntent("O'zim haqimda e'lon bermoqchiman")).toEqual({ who: "worker" });
    expect(detectPostIntent("Ўзим ҳақимда эълон")).toEqual({ who: "worker" });
    expect(detectPostIntent("E'lon bermoqchiman")).toEqual({ who: null });
  });
  it("qidiruv — e'lon emas", () => {
    expect(detectPostIntent("Menga haydovchi kerak")).toBeNull();
    expect(detectPostIntent("Vakansiyalar bormi")).toBeNull();
    expect(detectPostIntent("Men elektrikman")).toBeNull();
  });
});

describe("postTopic — e'lon niyatidan qolgan mazmun", () => {
  it("faqat niyat bo'lsa — bo'sh (yordamchi o'zi so'raydi)", () => {
    expect(postTopic("Vakansiya joylamoqchiman")).toBe("");
    expect(postTopic("O'zim haqimda e'lon bermoqchiman")).toBe("");
    expect(postTopic("e'lon bermoqchiman")).toBe("");
    expect(postTopic("Salom, menga vakansiya joylash kerak")).toBe("");
  });
  it("kasb yoki joy aytilgan bo'lsa — saqlanadi", () => {
    expect(postTopic("Men oshpazman, o'zim haqimda e'lon bermoqchiman")).toBe("oshpazman");
    expect(postTopic("Toshkentga haydovchi kerak, vakansiya joylamoqchiman")).toBe("Toshkentga haydovchi");
  });
});
