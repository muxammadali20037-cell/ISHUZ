/**
 * Markdown-lite: abzatslar (bo'sh qator), "- " ro'yxat, **qalin**.
 * Xom HTML hech qachon render qilinmaydi — hamma narsa matn tuguni sifatida chiqadi.
 * Bu fayl "@/..." importlarsiz yoziladi, shunda vitest'da alias sozlamasiz test qilinadi.
 */

export type InlineNode = { type: "text"; value: string } | { type: "bold"; value: string } | { type: "br" };
export type Block = { type: "paragraph"; children: InlineNode[] } | { type: "list"; items: InlineNode[][] };

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/;

/** **qalin** belgilarini ajratadi; yopilmagan ** oddiy matn bo'lib qoladi */
export function parseInline(text: string): InlineNode[] {
  const out: InlineNode[] = [];
  const re = /\*\*([^*]+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ type: "text", value: text.slice(last, m.index) });
    out.push({ type: "bold", value: m[1] ?? "" });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

function parseLines(lines: string[]): InlineNode[] {
  const nodes: InlineNode[] = [];
  lines.forEach((line, i) => {
    if (i > 0) nodes.push({ type: "br" });
    nodes.push(...parseInline(line));
  });
  return nodes;
}

/** Matn → bloklar. Bo'sh matn → []. */
export function parseDescription(text: string | null | undefined): Block[] {
  if (!text) return [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: InlineNode[][] = [];

  const flushPara = () => {
    if (para.length) blocks.push({ type: "paragraph", children: parseLines(para) });
    para = [];
  };
  const flushList = () => {
    if (list.length) blocks.push({ type: "list", items: list });
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === "") {
      flushPara();
      flushList();
      continue;
    }
    const bullet = BULLET.exec(line);
    if (bullet) {
      flushPara();
      list.push(parseInline((bullet[1] ?? "").trim()));
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return blocks;
}

/** Ro'yxat/kartalar uchun oddiy matn: belgilarsiz, bitta qatorda */
export function descriptionExcerpt(text: string | null | undefined, max = 160): string {
  if (!text) return "";
  const plain = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(BULLET, "$1").replace(/\*\*([^*]+?)\*\*/g, "$1").trim())
    .filter(Boolean)
    .join(" · ");
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}

function Inline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        if (n.type === "br") return <br key={i} />;
        if (n.type === "bold") return <strong key={i}>{n.value}</strong>;
        return <span key={i}>{n.value}</span>;
      })}
    </>
  );
}

/** Xavfsiz renderer: faqat <p>, <ul>/<li>, <strong>, <br> */
export function Description({ text, className }: { text: string | null | undefined; className?: string }) {
  const blocks = parseDescription(text);
  if (!blocks.length) return null;
  return (
    <div className={["space-y-3 text-[15px] leading-relaxed", className].filter(Boolean).join(" ")}>
      {blocks.map((b, i) =>
        b.type === "paragraph" ? (
          <p key={i}>
            <Inline nodes={b.children} />
          </p>
        ) : (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {b.items.map((item, j) => (
              <li key={j}>
                <Inline nodes={item} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
