import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { oklchToHex } from "@/lib/color";

/**
 * Brend ranglari kontrasti (WCAG 2.1 AA, oddiy matn ≥ 4.5:1) — yorug' (:root) va qorong'i (.dark) mavzuda.
 * Tokenlar globals.css dan o'qiladi: rang o'zgarsa va juftlik AA dan tushsa — test yiqiladi.
 */

const css = fs.readFileSync(path.join(__dirname, "../app/globals.css"), "utf8");

function block(selector: string): Record<string, string> {
  const m = css.match(new RegExp(`(?:^|\\n)${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`${selector} topilmadi`);
  const out: Record<string, string> = {};
  for (const [, k, v] of m[1]!.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\b/g)) out[k!] = v!;
  // 5.0: oklch(L C H) tokenlari ham (shaffofligi bo'lganlari — kontrast juftligi emas, o'tkaziladi)
  for (const [, k, l, c, h] of m[1]!.matchAll(/--([a-z-]+):\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/g)) out[k!] = oklchToHex(+l!, +c!, +h!);
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
  // "AI yordamchi" (to'q sariq): matn kartada, fonda va och sariq fonda; tugma ustidagi matn; yon menyuda (navy)
  ["ai", "card"],
  ["ai", "background"],
  ["ai", "ai-soft"],
  ["ai-foreground", "ai"],
  ["ai-bright", "navy"],
  ["card", "muted-foreground"],
  // premium bosh ekran sirti (.hero-surface): oq va och matn uchala rang nuqtasida
  ["hero-fg", "hero-from"],
  ["hero-fg", "hero-via"],
  ["hero-fg", "hero-to"],
  ["hero-muted", "hero-via"],
  ["hero-muted", "hero-to"],
  // 3.0: bosh sahifa navy banneri (.hero-navy) — oq sarlavha, och izoh va ko'k urg'u so'zlar
  ["navy-foreground", "navy"],
  ["navy-muted", "navy"],
  ["hero-accent", "navy"],
];

/** Matn bo'lmagan UI elementlari (tugma chegarasi, fokus halqasi, faol chiziq): WCAG 1.4.11 — kamida 3:1 */
const UI_PAIRS: [string, string][] = [
  ["primary", "background"],
  ["primary", "card"],
  ["ring", "background"],
  ["brand-green", "card"],
  // 3.0 rangli belgi plitkalari: belgi o'z och fonida
  ["tint-blue-ink", "tint-blue"],
  ["tint-violet-ink", "tint-violet"],
  ["tint-green-ink", "tint-green"],
  ["tint-orange-ink", "tint-orange"],
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

describe("5.0 palitrasi (2026-11-16, ega \"ko'k-oq\" dizayni; docs/DESIGN_SYSTEM.md)", () => {
  const raw = (name: string) => css.match(new RegExp(`:root\\s*\\{[^}]*--${name}:\\s*([^;]+);`))?.[1]?.trim();
  it("talabdagi tokenlar o'z joyida (oklch)", () => {
    expect(raw("background")).toBe("oklch(0.982 0.004 250)");
    expect(raw("foreground")).toBe("oklch(0.2 0.03 260)");
    expect(raw("card")).toBe("oklch(1 0 0)");
    expect(raw("primary")).toBe("oklch(0.52 0.2 260)");
    expect(raw("primary-foreground")).toBe("oklch(0.99 0 0)");
    expect(raw("primary-soft")).toBe("oklch(0.95 0.03 260)");
    expect(raw("secondary")).toBe("oklch(0.96 0.01 255)");
    expect(raw("muted")).toBe("oklch(0.96 0.008 255)");
    expect(raw("muted-foreground")).toBe("oklch(0.52 0.03 260)");
    expect(raw("brand-green")).toBe("oklch(0.62 0.15 155)");
    expect(raw("warm")).toBe("oklch(0.66 0.18 45)");
    expect(raw("border")).toBe("oklch(0.92 0.01 255)");
    expect(raw("ring")).toBe("oklch(0.52 0.2 260)");
    expect(raw("radius")).toBe("0.875rem");
    expect(raw("gradient-brand")).toBe("linear-gradient(135deg, oklch(0.55 0.21 262), oklch(0.62 0.17 230))");
  });
  it("qorong'i mavzu foni va kartochkasi", () => {
    const dark = block(".dark");
    expect(dark.background).toBe(oklchToHex(0.129, 0.042, 264));
    expect(dark.card).toBe(oklchToHex(0.208, 0.042, 265));
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
