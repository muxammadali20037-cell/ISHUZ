import { describe, expect, it } from "vitest";
import { descriptionExcerpt, parseDescription, parseInline } from "./description";

describe("parseInline", () => {
  it("ajratadi **qalin** matnni", () => {
    expect(parseInline("Kassir **kerak** hozir")).toEqual([
      { type: "text", value: "Kassir " },
      { type: "bold", value: "kerak" },
      { type: "text", value: " hozir" },
    ]);
  });

  it("yopilmagan ** oddiy matn bo'lib qoladi", () => {
    expect(parseInline("a **b c")).toEqual([{ type: "text", value: "a **b c" }]);
  });

  it("xom HTML matn sifatida qoladi (render qilinmaydi)", () => {
    const nodes = parseInline('<script>alert("x")</script>');
    expect(nodes).toEqual([{ type: "text", value: '<script>alert("x")</script>' }]);
  });
});

describe("parseDescription", () => {
  it("bo'sh matn → []", () => {
    expect(parseDescription("")).toEqual([]);
    expect(parseDescription(null)).toEqual([]);
    expect(parseDescription("   \n\n  ")).toEqual([]);
  });

  it("bo'sh qator abzatslarni ajratadi, bitta qator ichida br", () => {
    const blocks = parseDescription("Birinchi qator\nikkinchi qator\n\nYangi abzats");
    expect(blocks).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "text", value: "Birinchi qator" },
          { type: "br" },
          { type: "text", value: "ikkinchi qator" },
        ],
      },
      { type: "paragraph", children: [{ type: "text", value: "Yangi abzats" }] },
    ]);
  });

  it("- bilan boshlangan qatorlar ro'yxat bo'ladi", () => {
    const blocks = parseDescription("Vazifalar:\n- Kassa bilan ishlash\n- **Mijozlar** bilan muloqot\n* uchinchi\n1. to'rtinchi\nOddiy matn");
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toEqual({ type: "paragraph", children: [{ type: "text", value: "Vazifalar:" }] });
    expect(blocks[1]).toEqual({
      type: "list",
      items: [
        [{ type: "text", value: "Kassa bilan ishlash" }],
        [
          { type: "bold", value: "Mijozlar" },
          { type: "text", value: " bilan muloqot" },
        ],
        [{ type: "text", value: "uchinchi" }],
        [{ type: "text", value: "to'rtinchi" }],
      ],
    });
    expect(blocks[2]).toEqual({ type: "paragraph", children: [{ type: "text", value: "Oddiy matn" }] });
  });

  it("Windows qator oxirlarini ham tushunadi", () => {
    expect(parseDescription("a\r\n\r\nb")).toEqual([
      { type: "paragraph", children: [{ type: "text", value: "a" }] },
      { type: "paragraph", children: [{ type: "text", value: "b" }] },
    ]);
  });
});

describe("descriptionExcerpt", () => {
  it("belgilarni olib tashlab bitta qatorga keltiradi", () => {
    expect(descriptionExcerpt("**Kassir**\n- kassa\n- mijoz")).toBe("Kassir · kassa · mijoz");
  });

  it("uzun matnni qisqartiradi", () => {
    const out = descriptionExcerpt("a".repeat(300), 50);
    expect(out.length).toBe(50);
    expect(out.endsWith("…")).toBe(true);
  });
});
