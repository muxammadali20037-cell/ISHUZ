import { describe, expect, it } from "vitest";
import { understandMasterQuery } from "./understand";

describe("understandMasterQuery — usta qidiruvi va «Qanday ustasiz?» (ega, 2026-11-23)", () => {
  it.each([
    ["santexnik kerak", "plumber"],
    ["Santexnikman", "plumber"],
    ["сантехник нужен", "plumber"],
    ["konditsioner ustasi kerak", "ac"],
    ["konditsoner", "ac"],
    ["кондиционер", "ac"],
    ["kir yuvish mashinasi tuzataman", "appliance"],
    ["muzlatgich", "appliance"],
    ["tamirlash", "repair"],
    ["ta'mirlash ustasi", "repair"],
    ["remont kvartiry", "repair"],
    ["svarshik", "welder"],
    ["payvandchiman", "welder"],
    ["elektrik", "electric"],
    ["электрик", "electric"],
    ["bo'yoqchi", "painter"],
    ["boyoqchi kerak", "painter"],
    ["quruvchi", "builder"],
    ["g'isht teraman", "builder"],
    ["qulf ochish", "locksmith"],
    ["yuk tashish", "moving"],
    ["грузчик", "moving"],
    ["mebel yig'ish", "furniture"],
  ])("%s → %s", (text, slug) => {
    expect(understandMasterQuery(text).category).toBe(slug);
  });

  it("tushunilmagan so'z — kategoriya yo'q, so'z matn qidiruvi uchun qoladi", () => {
    expect(understandMasterQuery("akvarium tozalash")).toEqual({ category: null, rest: ["akvarium", "tozalash"] });
    expect(understandMasterQuery("usta kerak")).toEqual({ category: null, rest: [] });
  });

  it("kategoriya so'zi va ma'nosiz so'zlar matn qidiruviga qo'shilmaydi; qolgani — qoladi", () => {
    expect(understandMasterQuery("santexnik kerak Chilonzor").rest).toEqual(["chilonzor"]);
  });

  it("faqat bazadagi kategoriyalar", () => {
    expect(understandMasterQuery("santexnik", ["ac", "repair"]).category).toBeNull();
  });
});
