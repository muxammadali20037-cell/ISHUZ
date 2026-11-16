import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MASTER_SERVICE_KEYS } from "./services";

const ROOT = path.resolve(__dirname, "../../..");

describe("usta xizmatlari ro'yxati", () => {
  for (const locale of ["uz", "oz", "ru", "en"]) {
    it(`${locale}: har bir xizmat nomi bor va 40 belgidan oshmaydi (bazadagi chegara)`, () => {
      const m = JSON.parse(fs.readFileSync(path.join(ROOT, "messages", locale, "masters.json"), "utf8")) as { svc: Record<string, Record<string, string>> };
      const bad: string[] = [];
      for (const [slug, keys] of Object.entries(MASTER_SERVICE_KEYS)) {
        for (const k of keys) {
          const v = m.svc?.[slug]?.[k];
          if (typeof v !== "string" || v.length < 2 || v.length > 40) bad.push(`${slug}.${k}`);
        }
      }
      expect(bad).toEqual([]);
    });
  }
});
