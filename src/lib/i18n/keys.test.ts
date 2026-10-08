import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Koddagi har bir t("fayl.yo'l") kaliti 4 tilda ham mavjud bo'lishi shart
 * (aks holda foydalanuvchi yoki Telegram xabarida kalit nomi chiqib qoladi).
 */
const ROOT = path.resolve(__dirname, "../../..");
const LOCALES = ["uz", "oz", "ru", "en"] as const;

function loadMessages(locale: string): Record<string, unknown> {
  const dir = path.join(ROOT, "messages", locale);
  return Object.fromEntries(fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => [f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))]));
}

function lookup(m: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((n, p) => (n && typeof n === "object" && p in n ? (n as Record<string, unknown>)[p] : undefined), m);
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sourceFiles(p, out);
    else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}

describe("tarjima kalitlari", () => {
  const messages = Object.fromEntries(LOCALES.map((l) => [l, loadMessages(l)]));
  const namespaces = new Set(Object.keys(messages.uz!));
  const keys = new Map<string, string>();
  for (const f of sourceFiles(path.join(ROOT, "src"))) {
    fs.readFileSync(f, "utf8")
      .split("\n")
      .forEach((line, i) => {
        for (const m of line.matchAll(/\b(?:t|t2|tr)\(\s*"([a-z_]+\.[a-z0-9_.]+)"/g)) {
          if (namespaces.has(m[1]!.split(".")[0]!)) keys.set(m[1]!, `${path.relative(ROOT, f)}:${i + 1}`);
        }
      });
  }

  it("kodda ishlatilgan kalitlar topildi", () => {
    expect(keys.size).toBeGreaterThan(500);
  });

  for (const locale of LOCALES) {
    it(`${locale}: barcha kalitlar mavjud`, () => {
      const missing = [...keys].filter(([k]) => typeof lookup(messages[locale], k) !== "string").map(([k, at]) => `${k} @ ${at}`);
      expect(missing).toEqual([]);
    });
  }

  it("fayl ichida o'z nomi bilan ikkinchi daraja yo'q (masalan notifications.notifications.*)", () => {
    for (const locale of LOCALES) {
      for (const [ns, data] of Object.entries(messages[locale]!)) {
        if (ns === "admin") continue; // admin.notifications — haqiqiy bo'lim
        expect(Object.keys(data as object)).not.toContain(ns);
      }
    }
  });
});
