import { normalizeText } from "@/features/search/understand";

export type FindMode = "jobs" | "workers";

/**
 * "Buxgalter kerak" → ishchi qidiryapti (workers); "Buxgalterlik bo'yicha ish kerak" → ish qidiryapti (jobs).
 * O'zbek (lotin/kirill) va rus tilidagi odatiy iboralar. Aniqlab bo'lmasa — null (foydalanuvchidan bitta savol so'raladi).
 */
const JOB_PATTERNS: RegExp[] = [
  /\bish\s+(kerak|qidir|izla|bormi|bor|top)/, // ish kerak, ish qidiryapman
  /\bbo'?yicha\s+ish\b/, // buxgalterlik bo'yicha ish
  /\bish(i|ga|lar|larni)?\b(?!chi)/, // "haydovchi ishi", "ishga kiraman", yolg'iz "ish"
  /\bishla(moqchi|yman|y olaman|sh)/, // ishlamoqchiman
  /\bvakansiya/,
  /\b(rabota|rabotu|raboty|rabote|vakansii|vakansiya|trudoustroy)/, // работа, вакансии
  /\b(ishchu|ishu|ischu)\s+rabot/,
  /\bjob(s)?\b|\bvacanc/,
];

const WORKER_PATTERNS: RegExp[] = [
  /\bkerak\b/, // buxgalter kerak
  /\b(xodim|hodim|ishchi|ishchilar|mutaxassis|usta|ustalar)\b/,
  /\b(nujen|nujna|nujno|nujny|trebuetsya|trebuyutsya|ishchu|ishu|ischu|ishem|nanimayu|nanyat)\b/, // нужен, требуется, ищу (бухгалтера)
  /\b(hire|hiring|need(ed)?|looking for)\b/,
  /\bbor\s+mi\b/,
];

export function detectIntent(text: string): FindMode | null {
  const s = normalizeText(text);
  if (!s) return null;
  if (JOB_PATTERNS.some((r) => r.test(s))) return "jobs";
  if (WORKER_PATTERNS.some((r) => r.test(s))) return "workers";
  return null;
}

/** Maqsad va bog'lovchi so'zlar — kasb nomini topishga xalaqit bermasin */
const STOP = new Set(
  (
    "kerak kerakli ish ishi ishga ishlar ishlash ishlamoqchi ishlamoqchiman bor bormi uchun menga bizga qidiryapman qidiraman qidiryapmiz izlayman topish vakansiya vakansiyalar " +
    "va yoki bilan boyicha bo'yicha joy joyi xodim hodim ishchi ishchilar odam mutaxassis tajribali yaxshi shoshilinch tez " +
    "rabota rabotu raboty nujen nujna nujno nujny trebuetsya trebuyutsya vakansiya vakansii ishchu ishu v na dlya i ili s po " +
    "job jobs need needed hire hiring for a an the in looking"
  ).split(" "),
);

/** Qo'shimchalar: "buxgalterlik" → "buxgalter", "haydovchilar" → "haydovchi", "Toshkentda" → "toshkent" */
const SUFFIXES = ["chilikka", "chiligi", "chilik", "likka", "ligi", "lik", "larni", "larga", "larda", "lari", "lar", "ni", "ga", "da", "dan", "ning", "a", "u", "om", "ov"];

export function stripSuffix(token: string): string[] {
  const out: string[] = [];
  for (const suf of SUFFIXES) {
    if (token.length - suf.length >= 4 && token.endsWith(suf)) out.push(token.slice(0, -suf.length));
  }
  return out;
}

/** Rus/kirill so'zlari asl yozuvida ham qidiriladi (ruscha nomlar bazada kirillcha): "водителем" → "водител" */
const CYR_STOP = new Set("нужен нужна нужно нужны требуется требуются ищу ищем работа работу работы вакансия вакансии в на для и или с по кк керак иш ишчи".split(" "));
const CYR_SUFFIXES = ["ами", "ями", "ого", "ему", "ом", "ем", "ой", "ей", "ах", "ях", "ам", "ям", "а", "я", "у", "ю", "ы", "и", "е"];

function cyrillicCandidates(text: string): string[] {
  const out: string[] = [];
  for (const w of text.toLowerCase().split(/[^\p{L}'ʻ’-]+/u)) {
    if (w.length < 3 || !/[а-яёўқғҳ]/.test(w) || CYR_STOP.has(w)) continue;
    out.push(w);
    for (const suf of CYR_SUFFIXES) if (w.length - suf.length >= 4 && w.endsWith(suf)) out.push(w.slice(0, -suf.length));
  }
  return out;
}

/**
 * Kasb nomini qidirish uchun bo'laklar: avval to'liq ibora, keyin ikki so'zli, keyin bitta so'z va uning qo'shimchasiz shakli.
 * Maqsad so'zlari (kerak, ish, нужен) tashlab yuboriladi.
 */
export function professionCandidates(text: string): string[] {
  const words = normalizeText(text)
    .split(" ")
    .filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d/.test(w));
  const out: string[] = [];
  if (words.length > 1) out.push(words.join(" "));
  for (let i = 0; i < words.length - 1; i++) out.push(`${words[i]} ${words[i + 1]}`);
  for (const w of words) {
    out.push(w);
    out.push(...stripSuffix(w));
  }
  out.push(...cyrillicCandidates(text));
  return [...new Set(out)].slice(0, 14);
}
