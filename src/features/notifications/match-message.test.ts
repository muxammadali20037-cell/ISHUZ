import { describe, expect, it } from "vitest";
import { makeT } from "../../lib/i18n/translate";
import { employerMatchHtml, workerMatchHtml } from "./match-message";

const uz = makeT("uz");

describe("Telegram moslik xabari", () => {
  it("ishchiga: daraja so'z bilan, foiz yo'q", () => {
    const html = workerMatchHtml(uz, [{ title: "Buxgalter", employer: "Anor Market", place: "Toshkent shahri", salary: "", score: 92, reasons: [{ key: "profession_exact", ok: true }] }], 1);
    expect(html).toContain("Moslik: Juda mos");
    expect(html).not.toMatch(/\d+\s?%/);
  });

  it("ish beruvchiga: daraja so'z bilan, foiz yo'q", () => {
    const html = employerMatchHtml(uz, "Buxgalter", [{ name: "Botir", profession: "Buxgalter", place: "Toshkent shahri", experience: "", score: 55, reasons: [] }], 1);
    expect(html).toContain("Moslik: Mos");
    expect(html).not.toMatch(/\d+\s?%/);
  });
});
