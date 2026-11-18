import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn: loyihaning shrift o'lchamlari", () => {
  it.each(["2xs", "md", "sub", "section", "page", "page-lg"])("text-%s — o'lcham: rang saqlanadi", (size) => {
    expect(cn("text-destructive", `text-${size}`)).toBe(`text-destructive text-${size}`);
  });

  it("ikki o'lcham — oxirgisi qoladi; ikki rang — oxirgisi qoladi", () => {
    expect(cn("text-sm", "text-sub")).toBe("text-sub");
    expect(cn("text-sub text-muted-foreground", "text-destructive")).toBe("text-sub text-destructive");
  });
});
