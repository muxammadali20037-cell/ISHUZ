/**
 * Kasb oilalari (ega, 2026-11-22: "«ish kerak», «voditel», «oshpaz», «работа» deb yozsa ham mazmunan mos natijalar"):
 * ba'zi umumiy so'zlar bitta kasbni emas, butun sohani anglatadi. Masalan "kuryer" — piyoda, avto, moto, posilka,
 * oziq-ovqat kuryerlari: ular kasblar daraxtida alohida-alohida, va "kuryer" sinonimi faqat bittasida ("Piyoda kuryer").
 * Bunday so'z yozilsa — shu sohaning (kategoriyaning) hamma vakansiyalari qidiriladi.
 *
 * Lug'at qo'lda boshqariladi (shu fayl): faqat soha nomi bilan deyarli bir xil bo'lgan so'zlar. Kasbning o'z nomi bor
 * so'zlar ("haydovchi", "oshpaz") bu yerga kiritilmaydi — ular kasblar daraxtidagi aniq kasb (va uning ichidagilar)
 * bo'yicha qidiriladi: "haydovchi" sohasida dispetcher va aviatexnik ham bor.
 * Toza funksiyalar — bazasiz sinaladi.
 */
import { normalizeText } from "@/features/search/understand";

export const FAMILY_CATEGORIES = ["courier", "it", "call_center"] as const;
export type FamilyCategory = (typeof FAMILY_CATEGORIES)[number];

/** normalizeText qilingan holda (kirill → lotin): "курьер" → "kurer", "айти" → "ayti" */
const FAMILIES: Record<FamilyCategory, string[]> = {
  courier: ["kuryer", "kurer", "kuryerlik", "kuryer ishi", "dostavka", "dastavka", "dostavshik", "dostavshchik", "yetkazib berish", "yetkazib beruvchi", "kurerom", "kurera"],
  it: ["it", "ayti", "it soha", "it sohasi", "it sohada", "it mutaxassis", "it mutaxassisi", "aytishnik", "aytishnikom", "it spetsialist", "it specialist"],
  call_center: ["call center", "call markaz", "call-markaz", "koll tsentr", "koll-tsentr", "kol tsentr", "kol sentr", "koll sentr", "kol-tsentr", "call-center"],
};

/** so'rovdagi "ish", "kerak", "менга" kabi to'ldiruvchi so'zlar — oila so'zini aniqlashga xalaqit bermasin */
const FILLER = new Set(
  (
    "ish ishi ishga ishlar ishlash ishlamoqchiman ishlayman kerak kerakli bormi bor menga bizga men biz qidiryapman qidiraman izlayman " +
    "rabota rabotu raboty nujen nujna nujno ishchu ishu v na po sohasida sohasi sohada bo'yicha boyicha " +
    "job jobs work need looking for in"
  ).split(" "),
);

const PHRASES: Array<{ cat: FamilyCategory; words: string[] }> = FAMILY_CATEGORIES.flatMap((cat) =>
  FAMILIES[cat].map((p) => ({ cat, words: normalizeText(p.replace(/-/g, " ")).split(" ").filter(Boolean) })),
);

/**
 * Butun so'rov (to'ldiruvchi so'zlarsiz va hudud so'zlarisiz) oila so'ziga teng bo'lsa — kategoriya slugi, aks holda null.
 * "kuryer kerak" → courier; "IT sohasida ish" → it; "avtokuryer" → null (aniq kasb); "kuryer va haydovchi" → null.
 */
export function familyOf(text: string, placeWords: string[] = []): FamilyCategory | null {
  const places = placeWords.map((w) => normalizeText(w)).filter((w) => w.length >= 4);
  const words = normalizeText(text.replace(/-/g, " "))
    .split(" ")
    .filter((w) => w && !FILLER.has(w) && !places.some((p) => w.startsWith(p.slice(0, Math.max(4, p.length - 2)))));
  if (!words.length || words.length > 3) return null;
  const said = words.join(" ");
  for (const p of PHRASES) if (p.words.join(" ") === said) return p.cat;
  return null;
}

export function isFamilyCategory(slug: string | null | undefined): slug is FamilyCategory {
  return !!slug && (FAMILY_CATEGORIES as readonly string[]).includes(slug);
}

/**
 * Aniq kasb bo'yicha hech narsa chiqmaganda e'lon nomlarida qidirish uchun so'zlar: faqat foydalanuvchi yozgan va shu kasbning
 * nomi/sinonimiga tegishli so'zlar ("kuryer" — "Piyoda kuryer" sinonimi). Aloqasiz so'z ("toshkentda", "tez") olinmaydi —
 * aks holda bo'sh natija o'rniga aloqasiz e'lonlar chiqib qolardi. Kirill/lotin farqi hisobga olinmaydi (normalizeText).
 */
export function wordsRelatedTo(keywords: string[], terms: string[]): string[] {
  const termWords = new Set(terms.flatMap((t) => normalizeText(t.replace(/[-/()]/g, " ")).split(" ")).filter((w) => w.length >= 4));
  const out: string[] = [];
  for (const k of keywords) {
    const n = normalizeText(k);
    if (n.length < 4) continue;
    const stem = n.slice(0, Math.max(4, n.length - 2));
    if ([...termWords].some((w) => w.startsWith(stem) || n.startsWith(w.slice(0, Math.max(4, w.length - 2))))) out.push(k);
  }
  return [...new Set(out)];
}
