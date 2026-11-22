import { describe, expect, it } from "vitest";
import { formatNotes, stripNotes, withNotes } from "./notes";

describe("e'lon izohi (ega, 2026-11-22)", () => {
  it("«obed, yo'lkira tekin» → ikki band, ikkalasi ham tekin", () => {
    expect(formatNotes("obed, yo'lkira tekin")).toEqual(["Obed tekin", "Yo'lkira tekin"]);
  });
  it("qatorlar, nuqta-vergul, takrorlar va bo'sh joylar tartibga keladi", () => {
    expect(formatNotes("  yotoqxona bor;\nforma beriladi.\nYotoqxona bor ")).toEqual(["Yotoqxona bor", "Forma beriladi"]);
  });
  it("tanlangan tayyor variantlar avval, yozilgani keyin; telefon va havola olib tashlanadi", () => {
    expect(formatNotes("tel 90 123 45 67 qiling, t.me/xyz", ["Obed tekin"])).toEqual(["Obed tekin", "Tel qiling"]);
  });
  it("gaplar nuqtadan bo'linadi; raqamdan qolgan «Tel:» yorlig'i tushib qoladi", () => {
    expect(formatNotes("obed, yo'lkira tekin. Tel: 90 123 45 67", ["Yotoqxona bor"])).toEqual(["Yotoqxona bor", "Obed tekin", "Yo'lkira tekin"]);
    expect(formatNotes("Forma beriladi. Oylik o'z vaqtida!")).toEqual(["Forma beriladi", "Oylik o'z vaqtida"]);
  });
  it("ko'pi bilan 8 band, har biri 80 belgigacha", () => {
    expect(formatNotes(Array.from({ length: 12 }, (_, i) => `band ${i + 1} bor`).join(", "))).toHaveLength(8);
    expect(formatNotes("a".repeat(200))[0]).toHaveLength(80);
  });
  it("matnga ✅ bilan qo'shiladi; izoh bo'lmasa — o'zgarmaydi", () => {
    expect(withNotes("Oshpaz kerak.", ["Obed tekin", "Yo'lkira tekin"])).toBe("Oshpaz kerak.\n\n✅ Obed tekin\n✅ Yo'lkira tekin");
    expect(withNotes("Oshpaz kerak.", [])).toBe("Oshpaz kerak.");
  });
  it("avvalgi izoh olib tashlanadi (yangisi o'rniga)", () => {
    expect(stripNotes("Oshpazman.\n\n✅ Obed tekin\n✅ Yo'lkira tekin")).toBe("Oshpazman.");
    expect(stripNotes("Oshpazman.")).toBe("Oshpazman.");
  });
});
