import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

/**
 * CV (rezyume) → A4 PDF. Ma'lumot tayyor matnlar ko'rinishida keladi (tarjima chaqiruvchida),
 * bu yerda faqat chiroyli joylashtirish. Shrift: Manrope (lotin + kirill, OFL litsenziya).
 */
export interface CvPdfData {
  name: string;
  headline: string;
  /** "Savdo · Sotuvchi" */
  profession: string | null;
  /** Kichik yozuvlar: yosh, joylashuv, tajriba — "26 yosh", "Toshkent, Chilonzor" */
  facts: string[];
  contacts: string[];
  sections: { title: string; items: CvPdfItem[] }[];
  footer: string;
}

export type CvPdfItem =
  | { kind: "text"; text: string }
  | { kind: "entry"; title: string; subtitle?: string | null; period?: string | null; body?: string | null }
  | { kind: "chips"; items: string[] }
  | { kind: "pairs"; pairs: [string, string][] };

const A4 = { w: 595.28, h: 841.89 };
const M = { x: 48, top: 52, bottom: 56 };
const C = {
  ink: rgb(0.07, 0.09, 0.15),
  muted: rgb(0.39, 0.45, 0.55),
  primary: rgb(0.114, 0.373, 0.878),
  soft: rgb(0.91, 0.94, 0.99),
  line: rgb(0.88, 0.9, 0.93),
};

let fontCache: { regular: Uint8Array; bold: Uint8Array } | null = null;
async function loadFonts() {
  if (fontCache) return fontCache;
  const dir = path.join(process.cwd(), "src/features/cv/fonts");
  const [regular, bold] = await Promise.all([readFile(path.join(dir, "Manrope-Regular.ttf")), readFile(path.join(dir, "Manrope-Bold.ttf"))]);
  fontCache = { regular: new Uint8Array(regular), bold: new Uint8Array(bold) };
  return fontCache;
}

/** Shriftda yo'q belgilarni xavfsiz almashtirish (emoji va h.k. — PDF buzilmasin) */
function clean(text: string, font: PDFFont): string {
  const normalized = text.replace(/[’‘ʻʼ`]/g, "'").replace(/[“”«»]/g, '"').replace(/\t/g, " ");
  let out = "";
  for (const ch of normalized) {
    if (ch === "\n") {
      out += ch;
      continue;
    }
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      // qo'llab-quvvatlanmagan belgi tashlab yuboriladi
    }
  }
  return out;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      // juda uzun so'z — bo'lib yoziladi
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > maxWidth && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

export async function renderCvPdf(data: CvPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts = await loadFonts();
  const regular = await doc.embedFont(fonts.regular, { subset: true });
  const bold = await doc.embedFont(fonts.bold, { subset: true });
  doc.setTitle(`CV — ${data.name}`);
  doc.setCreator("Ish beruvchi");
  doc.setProducer("Ish beruvchi");

  const contentW = A4.w - M.x * 2;
  let page: PDFPage = doc.addPage([A4.w, A4.h]);
  let y = A4.h - M.top;

  const newPage = () => {
    page = doc.addPage([A4.w, A4.h]);
    y = A4.h - M.top;
  };
  const ensure = (h: number) => {
    if (y - h < M.bottom) newPage();
  };
  const text = (s: string, opts: { x?: number; size: number; font: PDFFont; color?: ReturnType<typeof rgb>; maxWidth?: number; lineGap?: number }) => {
    const lines = wrap(clean(s, opts.font), opts.font, opts.size, opts.maxWidth ?? contentW);
    const lh = opts.size * (opts.lineGap ?? 1.4);
    for (const line of lines) {
      ensure(lh);
      page.drawText(line, { x: opts.x ?? M.x, y: y - opts.size, size: opts.size, font: opts.font, color: opts.color ?? C.ink });
      y -= lh;
    }
  };

  // ---------- sarlavha ----------
  const initials = data.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  page.drawCircle({ x: M.x + 30, y: y - 30, size: 30, color: C.soft });
  const iw = bold.widthOfTextAtSize(clean(initials, bold), 20);
  page.drawText(clean(initials, bold), { x: M.x + 30 - iw / 2, y: y - 37, size: 20, font: bold, color: C.primary });
  const headX = M.x + 76;
  const headW = contentW - 76;
  const top = y;
  text(data.name, { x: headX, size: 22, font: bold, maxWidth: headW, lineGap: 1.25 });
  if (data.headline) text(data.headline, { x: headX, size: 13, font: bold, color: C.primary, maxWidth: headW });
  if (data.profession) text(data.profession, { x: headX, size: 10, font: regular, color: C.muted, maxWidth: headW });
  if (data.facts.length) text(data.facts.join("   ·   "), { x: headX, size: 10, font: regular, color: C.muted, maxWidth: headW });
  y = Math.min(y, top - 64) - 6;

  if (data.contacts.length) {
    ensure(30);
    page.drawRectangle({ x: M.x, y: y - 26, width: contentW, height: 26, color: C.soft, borderColor: C.soft });
    const line = clean(data.contacts.join("     "), regular);
    page.drawText(line, { x: M.x + 12, y: y - 17, size: 10, font: regular, color: C.ink, maxWidth: contentW - 24 });
    y -= 38;
  }

  // ---------- bo'limlar ----------
  for (const section of data.sections) {
    if (!section.items.length) continue;
    ensure(48);
    y -= 8;
    text(section.title.toUpperCase(), { size: 10.5, font: bold, color: C.primary });
    page.drawLine({ start: { x: M.x, y: y + 2 }, end: { x: M.x + contentW, y: y + 2 }, thickness: 0.8, color: C.line });
    y -= 8;

    for (const item of section.items) {
      if (item.kind === "text") {
        text(item.text, { size: 10.5, font: regular, lineGap: 1.5 });
        y -= 4;
      } else if (item.kind === "entry") {
        ensure(36);
        const periodW = item.period ? regular.widthOfTextAtSize(clean(item.period, regular), 9.5) : 0;
        const titleTop = y;
        text(item.title, { size: 11, font: bold, maxWidth: contentW - periodW - 12 });
        if (item.period) page.drawText(clean(item.period, regular), { x: M.x + contentW - periodW, y: titleTop - 11, size: 9.5, font: regular, color: C.muted });
        if (item.subtitle) text(item.subtitle, { size: 10, font: regular, color: C.muted });
        if (item.body) text(item.body, { size: 10, font: regular, lineGap: 1.45 });
        y -= 6;
      } else if (item.kind === "chips") {
        let x = M.x;
        const size = 9.5;
        const h = 18;
        ensure(h + 4);
        for (const chip of item.items) {
          const label = clean(chip, regular);
          const w = regular.widthOfTextAtSize(label, size) + 16;
          if (x + w > M.x + contentW) {
            x = M.x;
            y -= h + 6;
            ensure(h + 4);
          }
          page.drawRectangle({ x, y: y - h, width: w, height: h, color: C.soft });
          page.drawText(label, { x: x + 8, y: y - 12.5, size, font: regular, color: C.ink });
          x += w + 6;
        }
        y -= h + 10;
      } else if (item.kind === "pairs") {
        const labelW = 150;
        for (const [k, v] of item.pairs) {
          ensure(16);
          const rowTop = y;
          page.drawText(clean(k, regular), { x: M.x, y: y - 10.5, size: 10, font: regular, color: C.muted, maxWidth: labelW - 8 });
          text(v, { x: M.x + labelW, size: 10.5, font: bold, maxWidth: contentW - labelW });
          y = Math.min(y, rowTop - 16);
        }
        y -= 4;
      }
    }
  }

  // ---------- pastki yozuv (har sahifada) ----------
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const footer = clean(`${data.footer}${pages.length > 1 ? `   ·   ${i + 1}/${pages.length}` : ""}`, regular);
    const w = regular.widthOfTextAtSize(footer, 8.5);
    p.drawText(footer, { x: (A4.w - w) / 2, y: 28, size: 8.5, font: regular, color: C.muted });
  });

  return doc.save();
}
