import { describe, expect, it } from "vitest";
import { softHyphenate } from "./hyphenate";

const strip = (s: string) => s.replaceAll("­", "");

describe("softHyphenate", () => {
  it("uzun so'zga bo'g'in belgilari qo'yadi, matn o'zgarmaydi", () => {
    const out = softHyphenate("IT и программирование");
    expect(strip(out)).toBe("IT и программирование");
    expect(out.startsWith("IT и ")).toBe(true);
  });
  it("qisqa so'zlar va bo'shliqlar o'zgarmaydi", () => {
    expect(softHyphenate("Savdo va xizmat")).toBe("Savdo va xizmat");
  });
  it("bo'g'inlar bo'yicha bo'ladi, chetida kamida 3 harf qoladi", () => {
    expect(softHyphenate("Buxgalteriya").split("­")).toEqual(["Bux", "gal", "te", "riya"]);
    expect(softHyphenate("программирование").split("­")).toEqual(["прог", "рам", "ми", "ро", "ва", "ние"]);
  });
});
