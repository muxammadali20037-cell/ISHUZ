import { describe, expect, it } from "vitest";
import { safeFilterValue } from "./postgrest";

describe("safeFilterValue", () => {
  it("filtr sintaksisini buzadigan belgilar olib tashlanadi", () => {
    expect(safeFilterValue("a),is_blocked.eq.true,name.ilike.(b")).toBe("a  is_blocked.eq.true name.ilike. b");
    expect(safeFilterValue('x"\\y')).toBe("x  y");
  });
  it("LIKE shablon belgilari (% *) qolmaydi — hamma narsani qidirib bo'lmaydi", () => {
    expect(safeFilterValue("%")).toBe("");
    expect(safeFilterValue("*")).toBe("");
    expect(safeFilterValue("Excel")).toBe("Excel");
  });
});
