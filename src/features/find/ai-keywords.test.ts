import { describe, expect, it } from "vitest";
import { textKeywords } from "./ai-keywords";

describe("textKeywords — e'lon matnlari bo'yicha qidiruv uchun kalit so'zlar", () => {
  it("to'ldiruvchi so'zlar tashlanadi, kelishik qo'shimchasisiz o'zak ham beriladi", () => {
    expect(textKeywords("korzinkaga ishga kirmoqchiman")).toEqual(["korzinkaga", "korzinka"]);
  });

  it("tushunilgan hudud nomi kalit so'z bo'lmaydi (hudud alohida filtr)", () => {
    expect(textKeywords("Chilonzorda korzinka ishi bormi", ["Chilonzor tumani", "Toshkent shahri"])).toEqual(["korzinka"]);
    expect(textKeywords("toshkentda evos", ["Toshkent shahri", "город Ташкент"])).toEqual(["evos"]);
  });

  it("ruscha: xizmatchi so'zlar tashlanadi, so'z oxiri olib tashlangan ko'rinishi qo'shiladi", () => {
    expect(textKeywords("ищу работу бариста в ташкенте", ["Ташкент"])).toEqual(["бариста", "барист"]);
  });

  it("kirill o'zbekcha va apostrof turlari", () => {
    expect(textKeywords("менга корзинкада иш керак")).toEqual(["корзинкада", "корзинка"]);
    expect(textKeywords("Makro do‘konida ish")).toEqual(["do'konida", "do'koni", "makro"]);
  });

  it("uzun so'z birinchi, ko'pi bilan `limit` ta nomzod", () => {
    const words = textKeywords("havas supermarketga kassir yordamchisi", [], 4);
    expect(words).toHaveLength(4);
    expect(words[0]).toBe("supermarketga");
    expect(words[1]).toBe("supermarket");
  });

  it("faqat to'ldiruvchi so'z, son yoki qisqa bo'laklar — bo'sh ro'yxat", () => {
    expect(textKeywords("menga ish kerak")).toEqual([]);
    expect(textKeywords("5 mln so'm oylik")).toEqual([]);
    expect(textKeywords("ab cd")).toEqual([]);
  });
});
