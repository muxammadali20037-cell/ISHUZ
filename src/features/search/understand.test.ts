import { describe, expect, it } from "vitest";
import { buildDictionary, normalizeText, understandQuery, type UnderstandRefs } from "./understand";

const cat = (slug: string, name_uz: string, name_ru: string) => ({ id: `c-${slug}`, slug, name_uz, name_ru });
const sub = (c: string, slug: string, name_uz: string, name_ru: string, aliases: string[] = []) => ({ id: `s-${c}-${slug}`, slug, name_uz, name_ru, category_id: `c-${c}`, aliases });

const refs: UnderstandRefs = {
  categories: [
    cat("sales", "Savdo", "Продажи"),
    cat("restaurant", "Restoran va kafe", "Ресторан и кафе"),
    cat("craftsman", "Usta va ta'mirlash", "Мастер и ремонт"),
    cat("auto_service", "Avtoservis", "Автосервис"),
    cat("it", "IT va dasturlash", "IT и программирование"),
    cat("driver", "Haydovchi", "Водитель"),
    cat("plumber", "Santexnik", "Сантехник"),
    cat("call_center", "Call-markaz va operator", "Колл-центр и оператор"),
    cat("other", "Boshqa", "Другое"),
  ],
  subcategories: [
    sub("sales", "seller", "Sotuvchi", "Продавец", ["prodavets", "продавщица"]),
    sub("sales", "cashier", "Kassir", "Кассир"),
    sub("restaurant", "cook", "Oshpaz", "Повар", ["povar"]),
    sub("restaurant", "cook_assistant", "Oshpaz yordamchisi", "Помощник повара"),
    sub("restaurant", "waiter", "Ofitsiant", "Официант", ["afitsant"]),
    sub("craftsman", "welder", "Payvandchi", "Сварщик", ["svarchik", "svarshik"]),
    sub("auto_service", "motorist", "Motorist", "Моторист", ["motorchi"]),
    sub("it", "flutter", "Flutter dasturchi", "Flutter-разработчик", ["flutterchi"]),
    sub("it", "1c", "1C dasturchi", "1C-программист", ["1s", "1с"]),
    sub("driver", "cat_b", "Haydovchi (B toifa)", "Водитель (категория B)", ["shofyor"]),
    sub("plumber", "plumber", "Santexnik", "Сантехник", ["santehnik"]),
    sub("call_center", "operator", "Operator", "Оператор"),
    sub("other", "other", "Boshqa", "Другое"),
  ],
  regions: [
    { id: "r-tash", slug: "tashkent_city", name_uz: "Toshkent shahri", name_ru: "город Ташкент" },
    { id: "r-sam", slug: "samarkand", name_uz: "Samarqand viloyati", name_ru: "Самаркандская область" },
  ],
  districts: [
    { id: "d-chil", slug: "chilonzor", name_uz: "Chilonzor tumani", name_ru: "Чиланзарский район", region_id: "r-tash" },
    { id: "d-serg", slug: "sergeli", name_uz: "Sergeli tumani", name_ru: "Сергелийский район", region_id: "r-tash" },
    { id: "d-olm", slug: "olmazor", name_uz: "Olmazor tumani", name_ru: "Алмазарский район", region_id: "r-tash" },
    { id: "d-yun", slug: "yunusobod", name_uz: "Yunusobod tumani", name_ru: "Юнусабадский район", region_id: "r-tash" },
  ],
};
const dict = buildDictionary(refs);
const q = (text: string) => understandQuery(text, dict);

describe("normalizeText", () => {
  it("kirill → lotin, apostroflar", () => {
    expect(normalizeText("Ошпаз ЁРДАМЧИСИ")).toBe("oshpaz yordamchisi");
    expect(normalizeText("O‘qituvchi  Gʻalaba")).toBe("o'qituvchi g'alaba");
    expect(normalizeText("5 000 000 so'm")).toBe("5000000 so'm");
  });
});

describe("understandQuery", () => {
  it("tuman + kasb qo'shimchalar bilan", () => {
    const u = q("chilonzorda sotuvchi");
    expect(u.subcategory?.slug).toBe("seller");
    expect(u.category?.slug).toBe("sales");
    expect(u.districts.map((d) => d.slug)).toEqual(["chilonzor"]);
    expect(u.region?.slug).toBe("tashkent_city");
    expect(u.rest).toBe("");
  });

  it("xalq tilidagi nomlar va sinonimlar", () => {
    expect(q("svarchik kerak").subcategory?.slug).toBe("welder");
    expect(q("santexnik").subcategory?.slug).toBe("plumber");
    expect(q("flutterchi kerak").subcategory?.slug).toBe("flutter");
    expect(q("сварщика").subcategory?.slug).toBe("welder");
    expect(q("1С программист").subcategory?.slug).toBe("1c");
  });

  it("eng uzun ibora: oshpaz yordamchisi ≠ oshpaz", () => {
    expect(q("oshpaz yordamchisi").subcategory?.slug).toBe("cook_assistant");
    expect(q("oshpazlar kerak").subcategory?.slug).toBe("cook");
  });

  it("qolgan so'z matn qidiruvi uchun: mers servisda motorchi", () => {
    const u = q("mers servisda motorchi");
    expect(u.subcategory?.slug).toBe("motorist");
    expect(u.rest).toBe("mers servisda");
  });

  it("kechki smena, tajribasiz, uydan", () => {
    const a = q("kechki smena ish");
    expect(a.schedules).toEqual(["shift"]);
    expect(a.rest).toBe("");
    expect(q("tajribasiz ish").noExperience).toBe(true);
    const r = q("uydan ishlaydigan operator");
    expect(r.remote).toBe(true);
    expect(r.subcategory?.slug).toBe("operator");
  });

  it("maosh: kunlik 300 ming, 5 mln dan, $500", () => {
    const d = q("kunlik 300 ming ish");
    expect(d.salaryMin).toBe(300_000);
    expect(d.salaryKind).toBe("daily");
    const m = q("Olmazorda kassir 5 mln dan yuqori");
    expect(m.salaryMin).toBe(5_000_000);
    expect(m.salaryKind).toBe("monthly");
    expect(m.subcategory?.slug).toBe("cashier");
    expect(m.districts[0]?.slug).toBe("olmazor");
    expect(m.rest).toBe("");
    expect(q("$500").salaryMin).toBe(500 * 12_800);
    expect(q("4.5 mln").salaryMin).toBe(4_500_000);
  });

  it("raqamlar maosh deb olinmaydi: grafik, vaqt, yil", () => {
    const u = q("2/2 grafik 10 dan 22 gacha");
    expect(u.salaryMin).toBeNull();
    expect(u.schedules).toEqual(["2_2"]);
  });

  it("ruscha so'rov", () => {
    const u = q("работа повар без опыта Юнусабад");
    expect(u.subcategory?.slug).toBe("cook");
    expect(u.noExperience).toBe(true);
    expect(u.districts[0]?.slug).toBe("yunusobod");
    expect(u.rest).toBe("");
  });

  it("B toifali haydovchi", () => {
    expect(q("B toifali haydovchi").subcategory?.slug).toBe("cat_b");
  });

  it("tushunilmasa — hammasi rest ga", () => {
    const u = q("Anor market");
    expect(u.any).toBe(false);
    expect(u.rest).toBe("Anor market");
    expect(q("boshqa").category).toBeNull();
  });

  it("yarim stavka, frilans", () => {
    expect(q("yarim stavka ish").employment).toEqual(["part_time"]);
    expect(q("фриланс").employment).toEqual(["freelance"]);
  });

  it("tajriba: 2 yildan ko'p, tajribali", () => {
    const u = q("2 yildan ko'p tajribali oshpaz");
    expect(u.experienceMonths).toBe(24);
    expect(u.subcategory?.slug).toBe("cook");
    expect(u.salaryMin).toBeNull();
    expect(q("tajribali ofitsiant").experienceMonths).toBe(12);
    expect(q("tajribasiz ofitsiant").experienceMonths).toBeNull();
  });
});
