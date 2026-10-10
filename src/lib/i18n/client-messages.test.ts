import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { clientMessages, makeT } from "./translate";
import { createT } from "./core";

/**
 * Brauzerga faqat joriy til va kerakli bo'limlar yuboriladi (admin/huquqiy/bot/CV — serverda).
 * Client komponent shu bo'limlardan kalit ishlatsa, ekranda kalit nomi chiqib qoladi — shuni ushlaymiz.
 */
const ROOT = path.resolve(__dirname, "../../..");
const SERVER_ONLY = ["admin", "legal", "bot", "cv"];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sourceFiles(p, out);
    else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}

describe("clientMessages", () => {
  it("faqat bitta til, server bo'limlarisiz", () => {
    const ru = clientMessages("ru");
    for (const ns of SERVER_ONLY) expect(ru).not.toHaveProperty(ns);
    expect(ru).toHaveProperty("common");
    expect(createT(ru)("common.sound.on")).toBe(makeT("ru")("common.sound.on"));
  });

  it("admin panel o'z bo'limini oladi", () => {
    const m = clientMessages("uz", { admin: true });
    expect(m).toHaveProperty("admin");
    expect(m).not.toHaveProperty("legal");
  });

  it("client komponentlar server bo'limlari kalitlarini ishlatmaydi (admin paneldan tashqari)", () => {
    const bad: string[] = [];
    const re = new RegExp(`\\bt\\(\\s*[\`"'](${SERVER_ONLY.join("|")})\\.`, "g");
    for (const f of sourceFiles(path.join(ROOT, "src"))) {
      const rel = path.relative(ROOT, f);
      const src = fs.readFileSync(f, "utf8");
      if (!/^["']use client["']/.test(src.trimStart())) continue;
      for (const m of src.matchAll(re)) {
        if (m[1] === "admin" && /^src\/(features|app)\/admin\//.test(rel)) continue;
        bad.push(`${rel}: ${m[0]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
