/**
 * Uzun so'zlarga yashirin bo'g'in belgisi (U+00AD) qo'yadi: tor kartada so'z sig'masa, brauzer uni shu joydan "-" bilan
 * bo'ladi ("программи-рование"), harf o'rtasidan emas. `hyphens: auto` hamma qurilmada (masalan, Linux, ba'zi Android)
 * ishlamaydi — shu sababli. Qisqa so'zlar o'zgarmaydi; ko'rinadigan matn bir xil (belgi faqat bo'linganda ko'rinadi).
 */
const VOWEL = /[aeiouаеёиоуыэюяўAEIOUАЕЁИОУЫЭЮЯЎ]/;
const LETTER = /[a-zа-яёўқғҳ'ʻʼ]/i;
const SHY = "­";

const isVowel = (c: string | undefined) => !!c && VOWEL.test(c);
const isCons = (c: string | undefined) => !!c && LETTER.test(c) && !VOWEL.test(c) && !APOS.test(c);
const APOS = /['ʻʼ‘’]/;

/** Bo'g'in chegaralari: V|CV (unlidan keyin) yoki VC|CV (ikki undosh orasida); chetlarda kamida 3 harf */
export function softHyphenate(text: string, minWord = 11): string {
  return text.replace(/[^\s\-–—/]+/g, (word) => {
    if (word.length < minWord) return word;
    const cuts = new Set<number>();
    for (let i = 1; i < word.length; i++) {
      if (!isVowel(word[i])) continue;
      let at = -1;
      if (isCons(word[i + 1]) && isVowel(word[i + 2])) at = i;
      else if (isCons(word[i + 1]) && isCons(word[i + 2])) at = i + 1;
      if (at >= 2 && word.length - at - 1 >= 3 && !APOS.test(word[at + 1] ?? "")) cuts.add(at);
    }
    let out = "";
    for (let i = 0; i < word.length; i++) out += word[i] + (cuts.has(i) ? SHY : "");
    return out;
  });
}
