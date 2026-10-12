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
  ["primary", "card"],
  ["primary", "background"],
  ["primary-foreground", "primary"],
  ["primary", "primary-soft"],
  ["muted-foreground", "primary-soft"],
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
];

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
