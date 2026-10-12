import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Yordam sahifasi tugma va bo'lim nomlariga «...» bilan ishora qiladi. Har bir nom shu tilning interfeys matnlarida
 * aynan bo'lishi shart — aks holda yordam eskirgan (masalan, avval «+ Vakansiya joylashtirish», «Nomzodlar» kabi
 * interfeysda yo'q nomlar ko'rsatilardi).
 */
const ROOT = path.resolve(__dirname, "../../..");

function strings(node: unknown, out: Set<string>, skip: (p: string) => boolean, p = ""): Set<string> {
  if (typeof node === "string") {
    if (!skip(p)) out.add(node);
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) strings(v, out, skip, p ? `${p}.${k}` : k);
  }
  return out;
}

function load(locale: string) {
  const dir = path.join(ROOT, "messages", locale);
  return Object.fromEntries(fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => [f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))]));
}

describe("yordam sahifasi: ko'rsatilgan nomlar interfeysda bor", () => {
  for (const locale of ["uz", "oz", "ru", "en"]) {
    it(locale, () => {
      const m = load(locale);
      const help = (m.welcome as { help: Record<string, string> }).help;
      const ui = strings(m, new Set(), (p) => p.startsWith("welcome.help.") || p.startsWith("legal.") || p.startsWith("bot."));
      const quoted = Object.entries(help)
        .filter(([k]) => /^(worker|employer)_\d$/.test(k))
        .flatMap(([k, v]) => [...v.matchAll(/[«“]([^»”]+)[»”]/g)].map((x) => ({ key: k, label: x[1]! })));
      expect(quoted.length).toBeGreaterThan(10);
      const missing = quoted.filter((q) => !ui.has(q.label));
      expect(missing).toEqual([]);
    });
  }
});
