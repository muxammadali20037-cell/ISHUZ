import { normalizeText } from "@/features/search/understand";

/**
 * Usta qidiruvi va "Qanday ustasiz?" (ega, 2026-11-23: "ustalar bo'limida qidirsam bo'lmadi; qanday ustaligini qanday
 * yozmasin — tanib topsin"): yozilgan gapdan xizmat kategoriyasi. AI'siz, sof modul (mijozda ham ishlaydi):
 * lotin / kirill / rus (normalizeText), qo'shimchalar ("santexnikman", "konditsionerni"), imlo xatolari ("konditsoner",
 * "santexnk") — 1–2 harf farqi. Kategoriya so'zlari va xizmat so'zlari ("kran", "muzlatgich") — ikkalasi ham hisobga olinadi.
 */

/** kategoriya → so'zlar (normalizeText ko'rinishida; ko'p so'zli iboralar ham) */
const WORDS: Record<string, readonly string[]> = {
  ac: ["konditsioner", "kondisioner", "kondensioner", "kondentsioner", "kondicioner", "konditsaner", "kondey", "konder", "split", "freon", "klimat"],
  plumber: ["santexnik", "santehnik", "santexnika", "santex", "vodoprovod", "kanalizatsiya", "truba", "quvur", "kran", "unitaz", "rakovina", "smesitel", "vanna", "kotyol", "kotel", "suv oqyapti"],
  electric: ["elektrik", "elektr", "elektrika", "elektromontyor", "elektromontaj", "rozetka", "vyklyuchatel", "svet", "chiroq", "lyustra", "provodka", "elektr simi", "shchit", "shitok"],
  appliance: ["maishiy texnika", "texnika", "kir yuvish", "kir mashina", "stiralka", "stiralnaya", "muzlatgich", "xolodilnik", "holodilnik", "televizor", "plita", "gaz plita", "duxovka", "mikrovolnovka", "changyutgich", "pylesos"],
  repair: ["tamir", "tamirlash", "tamirchi", "remont", "evroremont", "kafel", "kafelchi", "plitka", "plitochnik", "shpaklyovka", "shpatlyovka", "shtukaturka", "suvoq", "suvoqchi", "gipsokarton", "laminat", "pardozlash", "otdelka", "pol"],
  painter: ["bo'yoqchi", "boyoqchi", "bo'yash", "boyash", "malyar", "kraska", "oboy", "gulqog'oz", "fasad"],
  builder: ["quruvchi", "qurilish", "stroitel", "stroyka", "g'isht", "gisht", "kirpich", "beton", "betonchi", "krovlya", "tom yopish", "fundament", "poydevor", "kladka", "g'ishtchi"],
  welder: ["payvandchi", "payvand", "svarka", "svarshik", "svarchik", "svarshchik", "darvoza", "vorota", "panjara", "naves", "ayvon", "metall"],
  locksmith: ["qulf", "qulfchi", "zamok", "zamki", "kalit", "klyuch", "eshik ochish", "vskrytie"],
  moving: ["yuk tashish", "yuk tashuvchi", "yukchi", "gruzchik", "gruzoperevozka", "gruzoperevozki", "pereezd", "ko'chish", "ko'chirish", "kochish", "damas", "labo", "gazel", "yuk mashina", "hammol"],
  furniture: ["mebel", "mebelchi", "mebelshik", "shkaf", "kupe", "oshxona mebeli", "yig'ish", "yigish", "sborka", "sborshik", "krovat"],
};

/** so'rovdagi ma'nosiz so'zlar (qidiruvni toraytirmaydi) */
const FILLER = new Set(
  [
    "usta", "ustasi", "ustalar", "ustalari", "ustani", "ustaga", "master", "mastera", "kerak", "kere", "kerek", "menga", "bizga", "sizga", "zarur",
    "chaqirish", "chaqirib", "chaqiraman", "xizmat", "xizmati", "xizmatlari", "xizmatlar", "tez", "tezda", "arzon", "yaxshi", "zo'r", "bor", "nujen",
    "nuzhen", "nuzhna", "nujno", "srochno", "uyga", "uy", "uyda", "uchun", "va", "ham", "bilan", "qilish", "qiladigan", "qiluvchi", "qilaman",
    "ishlayman", "men", "man", "ishi", "ish", "po", "dlya", "na", "v", "i", "s", "kto", "nado", "qaerda", "qayerda", "topish", "top",
  ].map((w) => normalizeText(w)),
);

function lev(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]!);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length]!;
}

/** yozilgan so'z kategoriya so'ziga mosmi: qo'shimcha bilan ("santexnikman"), qisqartma ("santex…"), imlo xatosi */
function wordHit(w: string, k: string): number {
  if (w === k) return 3;
  if (k.length >= 4 && w.startsWith(k)) return 2.5;
  if (w.length >= 5 && k.startsWith(w)) return 2;
  if (w.length >= 5 && k.length >= 5) {
    const d = lev(w.slice(0, k.length + 2), k, k.length >= 8 ? 2 : 1);
    if (d <= (k.length >= 8 ? 2 : 1)) return 1.5;
  }
  return 0;
}

export interface MasterQuery {
  /** topilgan kategoriya (slug) yoki null */
  category: string | null;
  /** kategoriyaga kirmagan, ma'noli so'zlar — matn qidiruvi uchun (asl yozilishida emas, normallashtirilgan) */
  rest: string[];
}

/** Yozilgan gap → kategoriya (eng yuqori ball) va qolgan so'zlar. `allowed` — mavjud kategoriyalar (bazada) */
export function understandMasterQuery(text: string, allowed?: readonly string[]): MasterQuery {
  const norm = normalizeText(text).replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
  if (!norm) return { category: null, rest: [] };
  const words = norm.split(" ").filter((w) => w.length >= 2);
  const used = new Set<number>();
  let best: { slug: string; score: number } | null = null;
  for (const [slug, keys] of Object.entries(WORDS)) {
    if (allowed && !allowed.includes(slug)) continue;
    let score = 0;
    for (const raw of keys) {
      const k = normalizeText(raw);
      if (k.includes(" ")) {
        // ibora: so'zlari ketma-ket (qo'shimcha bilan ham — "kir yuvish mashinasi")
        const parts = k.split(" ");
        for (let i = 0; i + parts.length <= words.length; i++) {
          if (parts.every((p, j) => wordHit(words[i + j]!, p) >= 2)) {
            score = Math.max(score, 3.5);
            parts.forEach((_, j) => used.add(i + j));
          }
        }
        continue;
      }
      words.forEach((w, i) => {
        const h = wordHit(w, k);
        if (h > 0) {
          score = Math.max(score, h);
          used.add(i);
        }
      });
    }
    if (score > 0 && (!best || score > best.score)) best = { slug, score };
  }
  const category = best?.slug ?? null;
  // ishlatilgan so'zlar boshqa kategoriyaga tegishli bo'lishi mumkin — qolganlari faqat topilgan kategoriyaga mos kelmaganlar
  const rest = words.filter((w, i) => !FILLER.has(w) && w.length >= 3 && !(category && used.has(i) && (WORDS[category] ?? []).some((k) => normalizeText(k).split(" ").some((p) => wordHit(w, p) > 0))));
  return { category, rest };
}
