import { describe, expect, it } from "vitest";
import { bestTypoMatch, editDistance, typoLimit, type TypoEntry } from "./typo";

const INDEX: TypoEntry[] = [
  { id: "oshpaz", depth: 2, terms: [{ t: "oshpaz", alias: false }, { t: "povar", alias: true }] },
  { id: "kassir", depth: 2, terms: [{ t: "kassir", alias: false }, { t: "kassirsha", alias: true }] },
  { id: "bank-kassir", depth: 3, terms: [{ t: "kassir", alias: true }] },
  { id: "elektrik", depth: 2, terms: [{ t: "elektrik", alias: false }] },
  { id: "sotuvchi", depth: 2, terms: [{ t: "sotuvchi", alias: false }] },
  { id: "oqituvchi", depth: 3, terms: [{ t: "o'qituvchi", alias: false }] },
  { id: "savatchi", depth: 3, terms: [{ t: "korzina", alias: true }] },
  { id: "restavrator", depth: 3, terms: [{ t: "restorer", alias: true }] },
];

describe("imlo xatosi", () => {
  it("masofa: almashtirish, tushib qolish, o'rin almashish", () => {
    expect(editDistance("oshpz", "oshpaz", 1)).toBe(1);
    expect(editDistance("elektirk", "elektrik", 1)).toBe(1);
    expect(editDistance("kasir", "kassir", 1)).toBe(1);
    expect(editDistance("salom", "oshpaz", 2)).toBe(3);
  });

  it("qisqa so'z tuzatilmaydi, uzunida ko'proq xato mumkin", () => {
    expect(typoLimit(4)).toBe(0);
    expect(typoLimit(5)).toBe(1);
    expect(typoLimit(8)).toBe(1);
    expect(typoLimit(9)).toBe(2);
  });

  it("oddiy xatolar eng yaqin kasbga", () => {
    expect(bestTypoMatch(["oshpz"], INDEX)?.id).toBe("oshpaz");
    expect(bestTypoMatch(["elektirk"], INDEX)?.id).toBe("elektrik");
    expect(bestTypoMatch(["sotuvhi"], INDEX)?.id).toBe("sotuvchi");
  });

  it("teng bo'lsa — kasbning o'z nomi sinonimdan ustun", () => {
    expect(bestTypoMatch(["kasir"], INDEX)?.id).toBe("kassir");
  });

  it("tutuq belgisi hisobga olinmaydi va boshqa kasbga 2 xato bilan og'ib ketmaydi", () => {
    expect(bestTypoMatch(["oqtuvchi"], INDEX)?.id).toBe("oqituvchi");
  });

  it("kasb bo'lmagan so'zlar kasbga aylanmaydi", () => {
    for (const w of ["kunlik", "salom", "rahmat", "restoran", "korzinkaga", "masofaviy", "uyda", "maosh", "ish"]) {
      expect(bestTypoMatch([w], INDEX), w).toBeNull();
    }
  });
});

describe("o'qituvchi (ega, 2026-11-17: «o'qituvchi», «uqituvchi», «oqtvchi» — hammasi o'qituvchi)", () => {
  const WITH_GROUP: TypoEntry[] = [
    ...INDEX.filter((e) => e.id !== "oqituvchi"),
    { id: "teacher-group", depth: 2, selectable: false, terms: [{ t: "o'qituvchi", alias: false }] },
    { id: "avtoinstruktor", depth: 3, terms: [{ t: "avtoinstruktor", alias: false }] },
  ];
  it("bitta harf xato — guruh (faqat qidiruvda, `groups`)", () => {
    expect(bestTypoMatch(["uqituvchi"], WITH_GROUP, { groups: true })?.id).toBe("teacher-group");
    expect(bestTypoMatch(["uqituvchi"], WITH_GROUP)).toBeNull();
  });
  it("unlilari tushib qolgan yozuv — undosh skeleti bo'yicha; kesim (-man) o'zagi ham", () => {
    expect(bestTypoMatch(["oqtvchi"], WITH_GROUP, { groups: true })?.id).toBe("teacher-group");
    expect(bestTypoMatch(["oqtvchiman"], WITH_GROUP, { groups: true })?.id).toBe("teacher-group");
  });
  it("skelet bir nechta kasbga mos kelsa yoki bosh harf boshqa bo'lsa — taxmin qilinmaydi", () => {
    const twin: TypoEntry[] = [
      { id: "a", depth: 2, terms: [{ t: "sotuvchi", alias: false }] },
      { id: "b", depth: 2, terms: [{ t: "satuvcha", alias: false }] },
    ];
    expect(bestTypoMatch(["stvch"], twin)).toBeNull();
    expect(bestTypoMatch(["aqtvchi"], WITH_GROUP, { groups: true })).toBeNull();
  });
});
