import { describe, expect, it } from "vitest";
import { familyOf, isFamilyCategory, wordsRelatedTo } from "./families";

describe("butun soha so'zlari (ega, 2026-11-22: \"mazmunan mos natijalar\")", () => {
  it("kuryer — lotin, kirill, ruscha va to'ldiruvchi so'zlar bilan", () => {
    for (const q of ["kuryer", "Kuryer kerak", "курьер", "Доставка", "dostavka ishi kerak", "kuryer ish bormi"]) expect(familyOf(q), q).toBe("courier");
  });
  it("IT va call-markaz", () => {
    expect(familyOf("IT")).toBe("it");
    expect(familyOf("IT sohasida ish kerak")).toBe("it");
    expect(familyOf("айти")).toBe("it");
    expect(familyOf("Call-markaz")).toBe("call_center");
    expect(familyOf("колл-центр")).toBe("call_center");
  });
  it("hudud nomi xalaqit bermaydi", () => {
    expect(familyOf("Toshkentda kuryer kerak", ["Toshkent", "shahri"])).toBe("courier");
  });
  it("aniq kasb yoki boshqa so'z qo'shilsa — soha emas (kasblar daraxti bo'yicha qidiriladi)", () => {
    expect(familyOf("avtokuryer")).toBeNull();
    expect(familyOf("moto kuryer")).toBeNull();
    expect(familyOf("haydovchi")).toBeNull();
    expect(familyOf("kuryer va haydovchi")).toBeNull();
    expect(familyOf("ish kerak")).toBeNull();
    expect(familyOf("")).toBeNull();
    // "it" so'zi boshqa so'zning ichida — soha emas
    expect(familyOf("itlar parvarishi")).toBeNull();
  });
  it("isFamilyCategory", () => {
    expect(isFamilyCategory("courier")).toBe(true);
    expect(isFamilyCategory("driver")).toBe(false);
    expect(isFamilyCategory(null)).toBe(false);
  });
});

describe("bo'sh natijada e'lon nomlaridan qidirish: faqat kasbga tegishli so'zlar", () => {
  const piyodaKuryer = ["Piyoda kuryer", "Пеший курьер", "Walking courier", "dostavka", "курьер", "kuryer"];
  it("kasbning nomi yoki sinonimiga mos so'z olinadi (kirill/lotin farqisiz)", () => {
    expect(wordsRelatedTo(["kuryer"], piyodaKuryer)).toEqual(["kuryer"]);
    expect(wordsRelatedTo(["курьер"], piyodaKuryer)).toEqual(["курьер"]);
    expect(wordsRelatedTo(["kuryerlar"], piyodaKuryer)).toEqual(["kuryerlar"]);
  });
  it("aloqasiz so'zlar (hudud, sifat) olinmaydi", () => {
    expect(wordsRelatedTo(["toshkentda", "tezkor", "yaxshi"], piyodaKuryer)).toEqual([]);
    expect(wordsRelatedTo(["ish"], piyodaKuryer)).toEqual([]);
  });
});
