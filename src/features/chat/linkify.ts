/** Oddiy matndagi URL'larni xavfsiz tokenlarga ajratadi (faqat http/https/www — javascript: va h.k. hech qachon havola bo'lmaydi). */
export type LinkToken = { type: "text"; value: string } | { type: "link"; value: string; href: string };

const URL_RE = /((?:https?:\/\/|www\.)[^\s<>"'`]+)/gi;
const TRAILING_PUNCT = /[.,;:!?'"»)\]]+$/;

function trimTrailing(raw: string): string {
  let s = raw;
  // oxiridagi tinish belgilarini olib tashlaymiz; ")" faqat juftsiz bo'lsa
  for (;;) {
    const m = TRAILING_PUNCT.exec(s);
    if (!m) break;
    const tail = m[0];
    const last = tail[tail.length - 1] ?? "";
    if (last === ")") {
      const opens = (s.match(/\(/g) ?? []).length;
      const closes = (s.match(/\)/g) ?? []).length;
      if (closes <= opens) break;
    }
    s = s.slice(0, -1);
  }
  return s;
}

export function tokenizeLinks(text: string): LinkToken[] {
  const out: LinkToken[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    const value = trimTrailing(m[0]);
    if (!value || value.length < 4) continue;
    if (start > last) out.push({ type: "text", value: text.slice(last, start) });
    const href = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    out.push({ type: "link", value, href });
    last = start + value.length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}
