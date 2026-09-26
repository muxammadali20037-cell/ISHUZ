/**
 * Vakansiya tavsifi (markdown-ga o'xshash matn) → xavfsiz bloklar.
 * Qo'llab-quvvatlanadi: paragraflar (bo'sh qator bilan), "- " / "* " / "• " / "1. " ro'yxatlar, "## sarlavha", **qalin**.
 * Boshqa hamma narsa oddiy matn sifatida qoladi (React o'zi escape qiladi, HTML yo'q).
 */
export type Inline = { type: "text"; value: string } | { type: "bold"; value: string };
export type Block =
  | { type: "paragraph"; lines: Inline[][] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "heading"; inlines: Inline[] };

const BULLET_RE = /^\s*(?:[-*•–]\s+|(\d{1,2})[.)]\s+)(.*)$/;
const HEADING_RE = /^\s*#{1,4}\s+(.*)$/;
const BOLD_RE = /\*\*([^*]+?)\*\*/g;

export function parseInlines(line: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of line.matchAll(BOLD_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ type: "text", value: line.slice(last, idx) });
    out.push({ type: "bold", value: m[1] ?? "" });
    last = idx + m[0].length;
  }
  if (last < line.length) out.push({ type: "text", value: line.slice(last) });
  return out.length ? out : [{ type: "text", value: line }];
}

export function parseDescription(text: string | null | undefined): Block[] {
  if (!text) return [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: Inline[][] = [];
  let list: { ordered: boolean; items: Inline[][] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", lines: paragraph });
    paragraph = [];
  };
  const flushList = () => {
    if (list && list.items.length) blocks.push({ type: "list", ordered: list.ordered, items: list.items });
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = HEADING_RE.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", inlines: parseInlines(heading[1]?.trim() ?? "") });
      continue;
    }
    const bullet = BULLET_RE.exec(line);
    if (bullet) {
      flushParagraph();
      const ordered = bullet[1] !== undefined;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(parseInlines(bullet[2]?.trim() ?? ""));
      continue;
    }
    flushList();
    paragraph.push(parseInlines(line.trim()));
  }
  flushParagraph();
  flushList();
  return blocks;
}

/** Meta/JSON-LD uchun oddiy matn (belgilar olib tashlanadi) */
export function descriptionToPlainText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\*\*([^*]+?)\*\*/g, "$1")
    .replace(/^\s*#{1,4}\s+/gm, "")
    .replace(/^\s*(?:[-*•–]|\d{1,2}[.)])\s+/gm, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Birinchi ~N belgi (so'z chegarasida) */
export function descriptionExcerpt(text: string | null | undefined, max = 160): string {
  const plain = descriptionToPlainText(text).replace(/\s+/g, " ");
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).trimEnd()}…`;
}
