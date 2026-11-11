import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Brend ranglari kontrasti (WCAG 2.1 AA, oddiy matn ≥ 4.5:1) — yorug' (:root) va qorong'i (.dark) mavzuda.
 * Tokenlar globals.css dan o'qiladi: rang o'zgarsa va juftlik AA dan tushsa — test yiqiladi.
 */

const css = fs.readFileSync(path.join(__dirname, "../app/globals.css"), "utf8");

function block(selector: string): Record<string, string> {
  const m = css.match(new RegExp(`(?:^|\\n)${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`${selector} topilmadi`);
  const out: Record<string, string> = {};
  for (const [, k, v] of m[1]!.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) out[k!] = v!;
  return out;
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

/** [matn, fon] — UI'da haqiqatan birga ishlatiladigan juftliklar */
const PAIRS: [string, string][] = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "secondary"],
  ["secondary-foreground", "secondary"],
  ["primary-ink", "card"],
  ["primary-ink", "background"],
  ["primary-foreground", "primary"],
  // 2.0: ko'k matn faqat --primary-ink orqali (text-primary-ink); --primary (#276FE5) — tugma foni
  ["accent-foreground", "accent"],
  ["primary-ink", "secondary"],
  ["primary-ink", "primary-soft"],
  ["muted-foreground", "primary-soft"],
  ["foreground", "hero-soft"],
  ["muted-foreground", "hero-soft"],
  ["primary-ink", "hero-soft"],
  ["foreground", "primary-soft"],
  ["success-foreground", "success"],
  ["success", "success-soft"],
  ["success", "card"],
  ["warning-foreground", "warning"],
  ["warning", "warning-soft"],
  ["warning", "card"],
  ["destructive-foreground", "destructive"],
  ["destructive", "destructive-soft"],
  ["destructive", "card"],
  ["info-foreground", "info"],
  ["info", "info-soft"],
  ["info", "card"],
  ["card", "muted-foreground"],
  // premium bosh ekran sirti (.hero-surface): oq va och matn uchala rang nuqtasida
  ["hero-fg", "hero-from"],
  ["hero-fg", "hero-via"],
  ["hero-fg", "hero-to"],
  ["hero-muted", "hero-via"],
  ["hero-muted", "hero-to"],
];

/** Matn bo'lmagan UI elementlari (tugma chegarasi, fokus halqasi, faol chiziq): WCAG 1.4.11 — kamida 3:1 */
const UI_PAIRS: [string, string][] = [
  ["primary", "background"],
  ["primary", "card"],
  ["ring", "background"],
  ["brand-green", "card"],
];

describe("UI elementlari kontrasti (≥ 3:1)", () => {
  const light = block(":root");
  const dark = { ...light, ...block(".dark") };
  for (const [theme, tokens] of [
    ["yorug'", light],
    ["qorong'i", dark],
  ] as const) {
    it(`${theme} mavzu`, () => {
      const low = UI_PAIRS.map(([fg, bg]) => ({ pair: `${fg} / ${bg}`, ratio: contrast(tokens[fg]!, tokens[bg]!) }))
        .filter((p) => p.ratio < 3)
        .map((p) => `${p.pair}: ${p.ratio.toFixed(2)}`);
      expect(low).toEqual([]);
    });
  }
});

describe("2.0 palitrasi (docs/DESIGN_SYSTEM.md)", () => {
  const light = block(":root");
  it("talabdagi asosiy ranglar o'z joyida", () => {
    expect(light.navy?.toLowerCase()).toBe("#101d35");
    expect(light.primary?.toLowerCase()).toBe("#276fe5");
    expect(light.background?.toLowerCase()).toBe("#f4f6fa");
    expect(light.card?.toLowerCase()).toBe("#ffffff");
    expect(light["brand-green"]?.toLowerCase()).toBe("#16a378");
    expect(light.foreground?.toLowerCase()).toBe("#172033");
    expect(light.border?.toLowerCase()).toBe("#e5eaf0");
  });
});

describe("brend ranglari kontrasti (AA ≥ 4.5:1)", () => {
  const light = block(":root");
  const dark = { ...light, ...block(".dark") };

  for (const [theme, tokens] of [
    ["yorug'", light],
    ["qorong'i", dark],
  ] as const) {
    it(`${theme} mavzu`, () => {
      const low = PAIRS.map(([fg, bg]) => ({ pair: `${fg} / ${bg}`, ratio: contrast(tokens[fg]!, tokens[bg]!) }))
        .filter((p) => p.ratio < 4.5)
        .map((p) => `${p.pair}: ${p.ratio.toFixed(2)}`);
      expect(low).toEqual([]);
    });
  }
});
