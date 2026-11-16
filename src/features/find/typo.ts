/**
 * Kasb nomidagi imlo xatosi ("oshpz", "kasir", "elektirk", "haydochi"): oddiy odam tez yozganda harf tushib qoladi yoki
 * o'rni almashadi. Lug'atda aniq mos kelmasa — bitta-ikkita harf farqi bilan eng yaqin kasb nomi olinadi.
 * Faqat qisqa farq: 5–8 harfli so'zda 1 ta, 9 va undan uzunida 2 ta xato; 5 harfdan qisqa so'z tuzatilmaydi
 * (aks holda oddiy so'zlar ham kasbga "aylanib" qoladi). Tutuq belgisi hisobga olinmaydi ("oqituvchi" = "o'qituvchi").
 * Toza funksiyalar — bazasiz sinaladi.
 */

export interface TypoTerm {
  /** normalizeText qilingan, bitta so'zli nom yoki sinonim */
  t: string;
  alias: boolean;
}

export interface TypoEntry {
  id: string;
  depth: number;
  terms: TypoTerm[];
  /** false — guruh (masalan "O'qituvchi": ichida aniq kasblar); faqat qidiruvda (`groups`) olinadi */
  selectable?: boolean;
}

/** Ruxsat etilgan xato soni so'z uzunligiga qarab */
export function typoLimit(len: number): number {
  if (len < 5) return 0;
  if (len < 9) return 1;
  return 2;
}

/** Tahrir masofasi (qo'shish, o'chirish, almashtirish va yonma-yon ikki harfning o'rni almashishi); `max` dan oshsa — max + 1 */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length;
  const n = b.length;
  let prev2: number[] = [];
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2]! + 1);
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[n]!;
}

const bare = (s: string) => s.replace(/'/g, "");

/** Undosh skeleti: "oqtvchi" → "qtvch", "o'qituvchi" → "qtvch" (unlilar tushib qolgan tez yozuv, SMS uslubi) */
export function consonantSkeleton(s: string): string {
  return bare(s).replace(/[aeiouy]/g, "");
}

/** "-man/-miz" (kesim: "oqtvchiman" — "men oqtvchiman") — o'zagi ham tekshiriladi */
function withoutPredicate(w: string): string[] {
  const m = /^(.{5,})(man|miz)$/.exec(w);
  return m ? [w, m[1]!] : [w];
}

/**
 * So'zlar (normalizeText qilingan, foydalanuvchi yozgan butun so'zlar — qo'shimchasi kesilgan bo'laklar emas) → eng yaqin kasb.
 * Teng bo'lsa: kamroq xato → asl nom (sinonim emas) → yuqoriroq tugun. Topilmasa — null.
 */
export function bestTypoMatch(words: string[], index: TypoEntry[], opts: { groups?: boolean } = {}): { id: string; term: string; distance: number } | null {
  let best: { id: string; term: string; distance: number; alias: boolean; depth: number } | null = null;
  const entries = opts.groups ? index : index.filter((e) => e.selectable !== false);
  const typed = [...new Set(words.flatMap((w) => withoutPredicate(bare(w))))];
  for (const w of typed) {
    const limit = typoLimit(w.length);
    if (!limit || w.includes(" ")) continue;
    for (const e of entries) {
      for (const term of e.terms) {
        const t = bare(term.t);
        if (t.length < 5) continue;
        const d = editDistance(w, t, limit);
        if (d > limit) continue;
        const better =
          !best ||
          d < best.distance ||
          (d === best.distance && (Number(term.alias) < Number(best.alias) || (term.alias === best.alias && e.depth < best.depth)));
        if (better) best = { id: e.id, term: term.t, distance: d, alias: term.alias, depth: e.depth };
      }
    }
  }
  if (best) return { id: best.id, term: best.term, distance: best.distance };
  // unlilari tushib qolgan yozuv ("oqtvchi", "oshpz"): undosh skeleti to'liq mos va bosh harfi bir xil — faqat bitta kasb bo'lsa
  for (const w of typed) {
    const sk = consonantSkeleton(w);
    if (sk.length < 4 || w.length < 5) continue;
    const hits = new Map<string, { id: string; term: string; alias: boolean; depth: number }>();
    for (const e of entries) {
      for (const term of e.terms) {
        const t = bare(term.t);
        if (t.length < 5 || t[0] !== w[0] || consonantSkeleton(t) !== sk) continue;
        const cur = hits.get(e.id);
        if (!cur || (cur.alias && !term.alias)) hits.set(e.id, { id: e.id, term: term.t, alias: term.alias, depth: e.depth });
      }
    }
    // bir nechta kasbga mos kelsa — taxmin qilinmaydi (asl nomli bitta bo'lsa — o'sha)
    const own = [...hits.values()].filter((h) => !h.alias);
    const pick = own.length === 1 ? own[0] : hits.size === 1 ? [...hits.values()][0] : undefined;
    if (pick) return { id: pick.id, term: pick.term, distance: 99 };
  }
  return null;
}
