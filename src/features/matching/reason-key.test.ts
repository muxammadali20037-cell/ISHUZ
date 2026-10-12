import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EMPLOYER_REASON_KEYS, matchReasonKey } from "./reason-key";

const ROOT = path.resolve(__dirname, "../../..");
const enums = (l: string) => JSON.parse(fs.readFileSync(path.join(ROOT, "messages", l, "enums.json"), "utf8")) as Record<string, Record<string, string>>;

describe("moslik sabablari: ish beruvchi nuqtai nazari", () => {
  it("ish beruvchi uchun alohida matn bor kalit — o'sha matn; qolganlari umumiy", () => {
    expect(matchReasonKey("profession_exact", "employer")).toBe("enums.match_reason_employer.profession_exact");
    expect(matchReasonKey("profession_exact")).toBe("enums.match_reason.profession_exact");
    expect(matchReasonKey("license_missing", "employer")).toBe("enums.match_reason.license_missing");
  });

  it("ro'yxat 4 tildagi match_reason_employer bilan bir xil", () => {
    for (const l of ["uz", "oz", "ru", "en"]) expect(new Set(Object.keys(enums(l).match_reason_employer!))).toEqual(EMPLOYER_REASON_KEYS);
  });

  it("ishchiga murojaat qiluvchi ('siz', '-ingiz') har bir sababning ish beruvchi varianti bor va unda murojaat yo'q", () => {
    const uz = enums("uz");
    const second = /\b(siz|sizga|sizdan)\b|ingiz/i;
    const addressed = Object.entries(uz.match_reason!).filter(([, v]) => second.test(v)).map(([k]) => k);
    expect(addressed.length).toBeGreaterThan(0);
    for (const k of addressed) expect(EMPLOYER_REASON_KEYS.has(k), k).toBe(true);
    for (const v of Object.values(uz.match_reason_employer!)) expect(v).not.toMatch(second);
    const en = enums("en");
    for (const v of Object.values(en.match_reason_employer!)) expect(v).not.toMatch(/\byou(r)?\b/i);
  });
});
