/**
 * Moderatsiya uchun matnni bir xil ko'rinishga keltirish (sof modul, testlanadi).
 *
 *  - kichik harf, Unicode NFKC, ko'rinmas belgilar olib tashlanadi;
 *  - kirill (o'zbek va rus) → lotin;
 *  - apostroflar bir xil (o‘ g‘ ʼ ’ → ');
 *  - harf o'rniga raqam/belgi ("1nt1m", "s3ks", "@") — so'z ichida harfga qaytariladi;
 *  - harflar orasidagi ajratgichlar ("i.n.t.i.m", "e r o t i k") va uzun takrorlar ("seeeks") yig'iladi.
 *
 * Natija faqat qoidalar uchun; foydalanuvchi matni o'zgartirilmaydi.
 */

const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n",
  о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "",
  э: "e", ю: "yu", я: "ya", ў: "o'", қ: "q", ғ: "g'", ҳ: "h", і: "i", ї: "i", є: "e",
};

/** Lotin harfiga o'xshash yunon/kirill belgilar (gomoglif) */
const HOMOGLYPH: Record<string, string> = { "α": "a", "ο": "o", "ε": "e", "ι": "i", "κ": "k", "ν": "v", "ρ": "p", "τ": "t", "χ": "x" };

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", $: "s", "€": "e", "|": "l", "!": "i" };

/** Asosiy ko'rinish: raqamlar saqlanadi (maosh va telefonni buzmaslik uchun) */
export function normalizeForModeration(input: string): string {
  let s = (input ?? "").normalize("NFKC").toLowerCase();
  s = s.replace(/[\u200b-\u200f\u2060\ufeff\u00ad]/g, "");
  s = s.replace(/[’‘`ʻʼ´]/g, "'");
  s = s.replace(/[а-яёўқғҳіїє]/g, (ch) => CYR[ch] ?? ch);
  s = s.replace(/[αοειρτχνκ]/g, (ch) => HOMOGLYPH[ch] ?? ch);
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** Yashirish usullarini ochadigan ko'rinish: leet, ajratilgan harflar, takrorlar */
export function deobfuscate(normalized: string): string {
  let s = normalized;
  // so'z ichidagi raqam/belgilar: harf bilan yonma-yon bo'lsa harfga aylanadi ("1nt1m" → "intim", "s3ks" → "seks")
  s = s.replace(/[a-z0-9@$€|!]+/g, (w) => (/[a-z]/.test(w) && /[0-9@$€|!]/.test(w) ? w.replace(/[0-9@$€|!]/g, (c) => LEET[c] ?? c) : w));
  // "i.n.t.i.m", "e r o t i k", "s-e-k-s" → bitta so'z
  s = s.replace(/\b(?:[a-z][\s._\-*·•,+/\\]{1,3}){2,}[a-z]\b/g, (m) => m.replace(/[^a-z]/g, ""));
  // 3+ marta takrorlangan harf → bitta ("seeeeks" → "seks")
  s = s.replace(/([a-z])\1{2,}/g, "$1");
  return s;
}

/** Ikkala ko'rinish birga: qoidalar ikkalasida ham tekshiriladi */
export function moderationVariants(input: string): string[] {
  const n = normalizeForModeration(input);
  const d = deobfuscate(n);
  return d === n ? [n] : [n, d];
}

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+|\b(?:t\.me|telegram\.me|wa\.me|bit\.ly|tinyurl\.com|instagram\.com)\/[^\s<>"']+/gi;

/** Matndagi havolalar (tekshiruv uchun alohida) */
export function extractLinks(text: string): string[] {
  return Array.from(new Set((text ?? "").match(URL_RE) ?? [])).slice(0, 30);
}
