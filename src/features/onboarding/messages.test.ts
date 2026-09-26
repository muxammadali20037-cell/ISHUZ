import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import uz from "../../../messages/uz/onboarding.json";
import ru from "../../../messages/ru/onboarding.json";

function flatKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => flatKeys(v, prefix ? `${prefix}.${k}` : k));
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry) && !entry.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

const uzKeys = new Set(flatKeys(uz, "onboarding"));
const root = join(__dirname, "..", "..");
const sources = [...walk(join(root, "features", "onboarding")), ...walk(join(root, "app", "onboarding"))].map((f) => readFileSync(f, "utf8"));

describe("onboarding tarjimalari", () => {
  it("uz va ru kalitlari bir xil", () => {
    expect(flatKeys(ru).sort()).toEqual(flatKeys(uz).sort());
  });

  it("kodda ishlatilgan statik kalitlar mavjud", () => {
    const used = new Set<string>();
    for (const src of sources) {
      for (const m of src.matchAll(/t\("(onboarding\.[a-zA-Z0-9_.]+)"/g)) used.add(m[1]!);
    }
    const missing = [...used].filter((k) => !uzKeys.has(k));
    expect(missing).toEqual([]);
  });

  it("sxema xato kalitlari (err('...')) mavjud", () => {
    const schema = readFileSync(join(root, "features", "onboarding", "schema.ts"), "utf8");
    const codes = new Set([...schema.matchAll(/err\("([a-z_]+)"\)/g)].map((m) => m[1]!));
    const missing = [...codes].filter((c) => !uzKeys.has(`onboarding.worker.errors.${c}`));
    expect(missing).toEqual([]);
  });

  it("action xato kodlari va dinamik kalitlar mavjud", () => {
    const codes = ["upload_failed", "geo_unavailable", "geo_denied", "phone_locked", "phone_taken", "no_worker", "incomplete_personal", "incomplete_location", "incomplete_profession", "max_files"];
    for (const c of codes) expect(uzKeys.has(`onboarding.worker.errors.${c}`), c).toBe(true);
    for (const step of ["personal", "location", "profession", "experience", "skills", "education", "portfolio", "preferences", "review"]) {
      expect(uzKeys.has(`onboarding.worker.steps.${step}.title`), step).toBe(true);
      expect(uzKeys.has(`onboarding.worker.steps.${step}.subtitle`), step).toBe(true);
    }
    for (let m = 1; m <= 12; m++) expect(uzKeys.has(`onboarding.worker.months.${m}`), `month ${m}`).toBe(true);
  });
});
