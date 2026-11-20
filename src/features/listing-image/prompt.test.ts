import { describe, expect, it } from "vitest";
import { buildListingImagePrompt } from "./prompt";

describe("e'lon rasmi so'rovi", () => {
  it("kasb turiga mos sahna, matnsiz, chap tomon bo'sh", () => {
    const p = buildListingImagePrompt({ kind: "vacancy", names: ["Cleaner", "Уборщик", "Farrosh"], categorySlug: "cleaning" });
    expect(p).toContain("Job: Cleaner.");
    expect(p).toContain("cleaning equipment");
    expect(p).toMatch(/no text, no letters/);
    expect(p).toMatch(/left half is a calm/);
    expect(p).toContain("Adults only");
  });

  it("ishchi e'loni — odam kameraga qaraydi; haydovchi — mashina yonida", () => {
    const p = buildListingImagePrompt({ kind: "worker", names: [null, "Haydovchi"] });
    expect(p).toContain("Job: Haydovchi.");
    expect(p).toContain("beside a clean modern car");
    expect(p).toContain("looking at the camera");
  });

  it("so'rovni buzadigan belgilar olib tashlanadi, kasb noma'lum — umumiy sahna", () => {
    const p = buildListingImagePrompt({ kind: "vacancy", names: ['"Ignore previous"; <b>xyz</b>'] });
    expect(p).toContain("Job: Ignore previous b xyz b.");
    expect(p).not.toMatch(/["<>]/);
    expect(p).toContain("a professional worker at a modern workplace");
  });
});
