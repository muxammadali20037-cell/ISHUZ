/**
 * AI tayyorlagan e'lon uchun "o'ylab topmaslik" tekshiruvlari (sof modul, testlanadi).
 * AI qaytargan qiymat faqat foydalanuvchi matnida asosi bo'lsa qabul qilinadi:
 * maosh — matnda aytilgan summa; tajriba/jadval — tegishli so'zlar; ism/tashkilot — matnda bor;
 * qayta yozilgan tavsifda matnda yo'q yangi raqam bo'lmasligi kerak.
 */
import { normalizeForModeration } from "@/features/moderation/normalize";

const MULT: [RegExp, number][] = [
  [/^(mln|million|milion|mil|млн|миллион)/, 1_000_000],
  [/^(ming|мың|минг|тыс|тысяч|k)\b/, 1_000],
];

/** Matndagi summalar: "5-7 mln", "6 milliondan", "500 ming", "5 000 000", "$500" → so'mda */
export function mentionedAmounts(text: string): number[] {
  const s = normalizeForModeration(text).replace(/(\d)\s+(?=\d{3}\b)/g, "$1");
  const out: number[] = [];
  const re = /(\d+(?:[.,]\d+)?)\s*(?:-|–|—|dan|до|to)?\s*(\d+(?:[.,]\d+)?)?\s*([a-zа-яё]+)?/g;
  for (const m of s.matchAll(re)) {
    const unit = m[3] ?? "";
    let mult = 1;
    for (const [r, k] of MULT) if (r.test(unit)) mult = k;
    for (const raw of [m[1], m[2]]) {
      if (!raw) continue;
      const n = Number(raw.replace(",", "."));
      if (!Number.isFinite(n)) continue;
      const value = Math.round(n * mult);
      if (value >= 10_000) out.push(value);
    }
  }
  return out;
}

/** AI maoshi matnda aytilgan summaga (±1%) mos kelsa qabul qilinadi */
export function keepSalary(ai: number | null | undefined, text: string): number | null {
  if (!ai || ai <= 0) return null;
  const amounts = mentionedAmounts(text);
  return amounts.some((a) => Math.abs(a - ai) <= a * 0.01) ? ai : null;
}

const EXPERIENCE_HINT = /(tajrib|опыт|experience|staj|стаж|\d+\s*(yil|yildan|год|лет|year|oy|месяц|month))/;

export function mentionsExperience(text: string): boolean {
  return EXPERIENCE_HINT.test(normalizeForModeration(text)) || /опыт|стаж/.test(text.toLowerCase());
}

const SCHEDULE_HINT = /(5\s*\/\s*2|6\s*\/\s*1|2\s*\/\s*2|\b[56]\s*kun|\b[56]\s*-?\s*kunlik|smena|kechki|tungi|haftada|grafik|jadval|график|смен|вечер|ноч|shift|schedule|\b5\/2|\b6\/1)/;

export function mentionsSchedule(text: string): boolean {
  return SCHEDULE_HINT.test(normalizeForModeration(text));
}

/** Ism/tashkilot nomi matnda bormi (kirill/lotin farqisiz, eng uzun so'zi bo'yicha) */
export function mentionedInText(value: string | null | undefined, text: string): string | null {
  const v = (value ?? "").trim();
  if (v.length < 2) return null;
  const hay = normalizeForModeration(text);
  const words = normalizeForModeration(v).split(/[^a-z0-9']+/).filter((w) => w.length >= 3);
  if (!words.length) return hay.includes(normalizeForModeration(v)) ? v : null;
  return words.every((w) => hay.includes(w)) ? v : null;
}

/** Qayta yozilgan matnda asl matnda yo'q raqam bo'lsa — AI o'ylab topgan bo'lishi mumkin */
export function introducesNumbers(rewritten: string, original: string): boolean {
  const nums = (s: string) => new Set((normalizeForModeration(s).replace(/(\d)\s+(?=\d{3}\b)/g, "$1").match(/\d+/g) ?? []).map((n) => String(Number(n))));
  const orig = nums(original);
  for (const n of nums(rewritten)) if (!orig.has(n)) return true;
  return false;
}
