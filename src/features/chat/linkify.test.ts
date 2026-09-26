import { describe, expect, it } from "vitest";
import { tokenizeLinks } from "./linkify";

describe("tokenizeLinks", () => {
  it("oddiy matn — bitta token", () => {
    expect(tokenizeLinks("Salom!")).toEqual([{ type: "text", value: "Salom!" }]);
  });
  it("https havola matn ichida", () => {
    expect(tokenizeLinks("Qarang: https://ish.uz/jobs/x, rahmat")).toEqual([
      { type: "text", value: "Qarang: " },
      { type: "link", value: "https://ish.uz/jobs/x", href: "https://ish.uz/jobs/x" },
      { type: "text", value: ", rahmat" },
    ]);
  });
  it("www. → https:// href", () => {
    expect(tokenizeLinks("www.ish.uz.")).toEqual([
      { type: "link", value: "www.ish.uz", href: "https://www.ish.uz" },
      { type: "text", value: "." },
    ]);
  });
  it("juft qavs saqlanadi, juftsiz olib tashlanadi", () => {
    expect(tokenizeLinks("(https://x.uz/a_(b))")[1]).toEqual({ type: "link", value: "https://x.uz/a_(b)", href: "https://x.uz/a_(b)" });
    expect(tokenizeLinks("https://x.uz/a)")[0]).toEqual({ type: "link", value: "https://x.uz/a", href: "https://x.uz/a" });
  });
  it("javascript: hech qachon havola emas", () => {
    expect(tokenizeLinks("javascript:alert(1)")).toEqual([{ type: "text", value: "javascript:alert(1)" }]);
  });
});
