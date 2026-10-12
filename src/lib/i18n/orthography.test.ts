import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** O'zbek imlosi: "Ish beruvchi", "Ish qidiruvchi" — ikkinchi so'z kichik harf bilan (avval "Ish Beruvchi" ko'rsatilardi) */
const ROOT = path.resolve(__dirname, "../../..");

function values(n: unknown, out: string[] = []): string[] {
  if (typeof n === "string") out.push(n);
  else if (n && typeof n === "object") for (const v of Object.values(n)) values(v, out);
  return out;
}

describe("o'zbek imlosi", () => {
  for (const locale of ["uz", "oz"]) {
    it(`${locale}: "Ish"dan keyingi so'z gap o'rtasida bosh harf bilan yozilmaydi`, () => {
      const dir = path.join(ROOT, "messages", locale);
      const all = fs.readdirSync(dir).flatMap((f) => values(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))));
      const bad = all.filter((s) => /(?<![\p{L}'])(Ish|Иш) [A-ZА-ЯЎҚҒҲЁ]/u.test(s));
      expect(bad).toEqual([]);
    });
  }
});
