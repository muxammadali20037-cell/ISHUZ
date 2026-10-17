import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Brend qo'riqchisi (docs/BRAND_UI_GUIDE.md): ekran komponentlarida faqat brend tokenlari ishlatiladi.
 * Yangi kodda xom Tailwind palitrasi, hex rang, gradient, blur yoki shkaladan tashqari o'lcham paydo bo'lsa — test yiqiladi.
 * Istisnolar faqat quyidagi ro'yxatda va har biri sababi bilan.
 */

const SRC = path.join(__dirname, "..");

/** Sababli istisnolar: fayl → qaysi qoidalardan ozod */
const ALLOW: Record<string, { rules: Rule[]; why: string }> = {
  "features/profile/components/cv/cv-document.tsx": { rules: ["palette", "hex", "px-text", "white"], why: "chop etiladigan CV — doim oq qog'oz, mavzudan mustaqil" },
  "features/promo/card.tsx": { rules: ["hex", "gradient"], why: "serverda PNG'ga chiziladigan ulashiladigan reklama kartasi (CSS tokenlari ishlamaydi)" },
  "app/global-error.tsx": { rules: ["hex"], why: "ildiz layout yiqilganda — globals.css yuklanmagan bo'lishi mumkin" },
  "app/layout.tsx": { rules: ["hex"], why: "brauzer themeColor meta (CSS emas)" },
  "features/auth/components/auth-form.tsx": { rules: ["hex"], why: "Telegram belgisining rasmiy rangi (uchinchi tomon logotipi)" },
  "features/entry/components/flags.tsx": { rules: ["hex"], why: "til kartalaridagi davlat bayroqlarining rasmiy ranglari (uchinchi tomon belgisi)" },
  "components/ui/checkbox.tsx": { rules: ["white"], why: "Switch tutqichi har ikki mavzuda oq (rangli/kulrang yo'lak ustida)" },
  "features/admin/components/mfa-form.tsx": { rules: ["white"], why: "QR kod faqat oq fonda o'qiladi" },
  "features/workers/components/portfolio-gallery.tsx": { rules: ["white"], why: "to'liq ekranli qora foto ko'rgich (mavzudan mustaqil)" },
};

type Rule = "palette" | "hex" | "gradient" | "blur" | "radius" | "px-text" | "shadow" | "white";

const RULES: Record<Rule, { re: RegExp; hint: string }> = {
  palette: {
    re: /\b(?:bg|text|border|from|via|to|ring|fill|stroke|outline|divide|decoration|caret|accent)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}\b/,
    hint: "palitra rangi o'rniga token: primary / success / warning / destructive / muted-foreground …",
  },
  hex: { re: /#[0-9a-fA-F]{6}\b|-\[#[0-9a-fA-F]{3,8}\]/, hint: "hex o'rniga globals.css dagi token" },
  gradient: { re: /bg-gradient-|bg-linear-|bg-radial-|linear-gradient\(|radial-gradient\(/, hint: "bezak gradienti yo'q — bitta sirt rangi" },
  blur: { re: /backdrop-blur|\bblur-(?:sm|md|lg|xl|2xl|3xl|\[)/, hint: "blur yo'q — to'liq sirt (bg-card / bg-background)" },
  radius: { re: /\brounded(?:-[trblse]{1,2})?-(?:3xl|4xl|\[)/, hint: "radius shkalasi: xs · sm · md · lg · xl · 2xl · full" },
  "px-text": { re: /\btext-\[\d+(?:\.\d+)?px\]/, hint: "shrift shkalasi: text-2xs · xs · sm · md · base · lg · xl …" },
  shadow: { re: /\bshadow-(?:xl|2xl|inner|\[)/, hint: "soyalar: shadow-sm (karta) · shadow-md (ko'tarilgan) · shadow-lg (faqat qalqib chiquvchi qatlam)" },
  // qorong'i mavzuda primary/success/destructive fonlari och rangga o'tadi — ustidagi matn *-foreground tokeni bo'lishi shart.
  // Istisno: foto/video ustidagi qora parda (shu qatorda bg-black bor)
  white: { re: /\b(?:text|bg|border)-white\b/, hint: "oq o'rniga *-foreground tokeni (qorong'i mavzuda ham o'qiladi)" },
};

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    // .ts ham: klass satrlari xaritalarda bo'lishi mumkin (masalan, holat ranglari tone.ts)
    else if (/\.tsx?$/.test(e.name) && !/\.(test|d)\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

describe("brend qo'riqchisi", () => {
  const files = walk(SRC);

  it("komponentlar fayllari topildi", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  for (const rule of Object.keys(RULES) as Rule[]) {
    it(`${rule}: ${RULES[rule].hint}`, () => {
      const hits: string[] = [];
      for (const f of files) {
        const rel = path.relative(SRC, f).split(path.sep).join("/");
        if (ALLOW[rel]?.rules.includes(rule)) continue;
        fs.readFileSync(f, "utf8")
          .split("\n")
          .forEach((line, i) => {
            if (rule === "white" && /\bbg-black\b/.test(line)) return;
            const m = line.match(RULES[rule].re);
            if (m) hits.push(`${rel}:${i + 1} → ${m[0]}`);
          });
      }
      expect(hits).toEqual([]);
    });
  }

  it("istisnolar ro'yxatidagi fayllar mavjud (eskirgan istisno qolmaydi)", () => {
    for (const rel of Object.keys(ALLOW)) expect(fs.existsSync(path.join(SRC, rel)), rel).toBe(true);
  });
});
