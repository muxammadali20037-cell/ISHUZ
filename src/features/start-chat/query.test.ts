import { describe, expect, it } from "vitest";
import { chatQuery } from "./query";

describe("chatQuery", () => {
  it("bitta qatorga keltiradi va qisqartiradi", () => {
    expect(chatQuery("  Menga   haydovchi\nkerak ")).toBe("Menga haydovchi kerak");
    expect(chatQuery("a".repeat(400))).toHaveLength(300);
  });
  it("bo'sh, juda qisqa yoki bir nechta q — yo'q", () => {
    expect(chatQuery(undefined)).toBe("");
    expect(chatQuery(" a ")).toBe("");
    expect(chatQuery(["x", "y"])).toBe("");
  });
});
