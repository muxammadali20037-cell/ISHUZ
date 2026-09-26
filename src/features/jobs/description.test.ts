import { describe, expect, it } from "vitest";
import { descriptionExcerpt, descriptionToPlainText, parseDescription, parseInlines } from "./description";

describe("parseInlines", () => {
  it("**qalin** ni ajratadi, qolganini matn qiladi", () => {
    expect(parseInlines("Maosh **5 mln** dan")).toEqual([
      { type: "text", value: "Maosh " },
      { type: "bold", value: "5 mln" },
      { type: "text", value: " dan" },
    ]);
  });
  it("HTML ni matn sifatida qoldiradi", () => {
    expect(parseInlines("<script>alert(1)</script>")).toEqual([{ type: "text", value: "<script>alert(1)</script>" }]);
  });
});

describe("parseDescription", () => {
  it("paragraf, ro'yxat va sarlavha", () => {
    const blocks = parseDescription("Savdo markazida kassir kerak.\nIkkinchi qator\n\n## Talablar\n- POS bilan ishlash\n* **1C** bilish\n\n1. Birinchi\n2) Ikkinchi\n");
    expect(blocks).toEqual([
      { type: "paragraph", lines: [[{ type: "text", value: "Savdo markazida kassir kerak." }], [{ type: "text", value: "Ikkinchi qator" }]] },
      { type: "heading", inlines: [{ type: "text", value: "Talablar" }] },
      { type: "list", ordered: false, items: [[{ type: "text", value: "POS bilan ishlash" }], [{ type: "bold", value: "1C" }, { type: "text", value: " bilish" }]] },
      { type: "list", ordered: true, items: [[{ type: "text", value: "Birinchi" }], [{ type: "text", value: "Ikkinchi" }]] },
    ]);
  });
  it("bo'sh/null → []", () => {
    expect(parseDescription(null)).toEqual([]);
    expect(parseDescription("  \n\n ")).toEqual([]);
  });
  it("CRLF ni ham tushunadi", () => {
    expect(parseDescription("a\r\n\r\nb")).toHaveLength(2);
  });
});

describe("descriptionToPlainText / descriptionExcerpt", () => {
  it("belgilarni olib tashlaydi", () => {
    expect(descriptionToPlainText("## Talablar\n- **POS**\n- 1C")).toBe("Talablar\nPOS\n1C");
  });
  it("so'z chegarasida qisqartiradi", () => {
    const text = "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore";
    const ex = descriptionExcerpt(text, 40);
    expect(ex.length).toBeLessThanOrEqual(41);
    expect(ex.endsWith("…")).toBe(true);
    expect(ex).not.toMatch(/\s…$/);
    expect(descriptionExcerpt("qisqa", 40)).toBe("qisqa");
  });
});
