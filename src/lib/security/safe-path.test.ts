import { describe, expect, it } from "vitest";
import { isSafeInternalPath, safeInternalPath } from "./safe-path";

describe("safeInternalPath", () => {
  it("ichki yo'l, so'rov va # saqlanadi", () => {
    expect(safeInternalPath("/post/vacancy?edit=1&step=4#top")).toBe("/post/vacancy?edit=1&step=4#top");
    expect(safeInternalPath("/")).toBe("/");
  });

  it.each([
    ["//evil.uz", "protokolsiz boshqa sayt"],
    ["/\\evil.uz", "teskari chiziq"],
    ["/\t/evil.uz", "tab (brauzer olib tashlaydi)"],
    ["/\n/evil.uz", "yangi qator"],
    ["/\r\n/evil.uz", "CRLF"],
    ["https://evil.uz/", "to'liq manzil"],
    ["javascript:alert(1)", "javascript:"],
    ["evil.uz", "nisbiy, / siz"],
    ["", "bo'sh"],
    ["/" + "a".repeat(2001), "juda uzun"],
  ])("%s — rad (%s)", (input) => {
    expect(safeInternalPath(input)).toBe("/");
  });

  it("null/undefined — zaxira yo'l", () => {
    expect(safeInternalPath(null, "/admin")).toBe("/admin");
    expect(safeInternalPath(undefined)).toBe("/");
  });

  it("kodlangan // (%2F%2F) yo'l ichida qoladi", () => {
    expect(safeInternalPath("/%2F%2Fevil.uz")).toBe("/%2F%2Fevil.uz");
  });

  it("isSafeInternalPath: faqat o'zgarishsiz qaytadigan yo'l", () => {
    expect(isSafeInternalPath("/jobs?vacancy=1")).toBe(true);
    expect(isSafeInternalPath("//evil.uz?vacancy=1")).toBe(false);
    expect(isSafeInternalPath("/\\evil.uz?vacancy=1")).toBe(false);
    expect(isSafeInternalPath("/a/../b")).toBe(false);
  });
});
