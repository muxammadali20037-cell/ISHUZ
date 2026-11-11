/**
 * AI qidiruvning oxirgi chorasi: matndan kasb aniqlanmasa (kasblar ro'yxatida yo'q so'z, kompaniya nomi, erkin lavozim),
 * e'lon matnlari (sarlavha, tavsif, kompaniya nomi) bo'yicha qidirish uchun kalit so'zlar ajratiladi.
 *
 * Qoidalar (sof funksiya, bazasiz):
 *  - kichik harf, apostrof turlari bitta ko'rinishga; faqat harfli bo'laklar;
 *  - 3 harfdan qisqa so'zlar, sonlar, to'ldiruvchi so'zlar ("ish", "kerak", "ищу", "job" …) va pul birliklari tashlanadi;
 *  - tushunilgan hudud nomlari (masalan "chilonzorda", "toshkentda") tashlanadi — hudud alohida filtr sifatida qo'llanadi;
 *  - har so'z uchun ikki ko'rinish: o'zi va kelishik qo'shimchasisiz o'zagi ("korzinkaga" → "korzinka", "повара" → "повар") —
 *    bazadagi qidiruv so'zni o'zgartirmaydi (stemming yo'q), sarlavhada esa o'zak turadi;
 *  - uzunroq so'z muhimroq deb olinadi; ko'pi bilan `limit` ta nomzod.
 */

const STOP = new Set(
  [
    // o'zbekcha (lotin)
    "ish ishi ishga ishni ishlar ishlash ishlamoqchiman ishlayman kerak kerakmi bormi bor yoq yo'q menga men biz bizga uchun bilan ham va yoki",
    "qidiryapman qidiraman qidirmoqdaman izlayapman izlayman topib toping topish ber bering kirmoqchiman xohlayman istayman joy joyi",
    "yaxshi qanday qaysi qayerda qayer shu bu eng yaqin atrofda atrofida oylik kunlik maosh maoshi haq tajriba tajribasiz",
    "iltimos salom assalomu alaykum rahmat xodim ishchi kishi odam",
    // o'zbekcha (kirill)
    "иш иши ишга керак борми бор менга мен учун билан ҳам ва ёки қидиряпман излаяпман топиб беринг яхши қандай ойлик кунлик маош салом ходим ишчи",
    // ruscha
    "работа работу работы работать ищу ищем нужна нужен нужно нужны требуется требуются есть для или вакансия вакансии вакансию",
    "хочу найти найди найдите мне меня где как рядом возле зарплата зарплатой оклад опыт опыта без опытом привет здравствуйте пожалуйста",
    "сотрудник сотрудника работник работника человек",
    // inglizcha
    "job jobs work working need needs looking for find want the and with near nearby salary experience without please hello worker employee",
    // pul birliklari
    "mln million ming so'm som sum млн тыс тысяч сум сумов",
  ]
    .join(" ")
    .split(" "),
);

/** Kelishik qo'shimchalari (uzunidan qisqasiga) — o'zak kamida 4 harf qolsa olib tashlanadi */
const SUFFIXES_UZ = ["lardan", "larga", "larni", "ning", "dagi", "dan", "lar", "ga", "da", "ni"];
const SUFFIXES_CYR = ["ларга", "лардан", "нинг", "даги", "дан", "лар", "ами", "ах", "ов", "ом", "ам", "га", "да", "ни", "а", "у", "ы", "е", "и"];

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ʻʼ’‘`´]/g, "'")
    .replace(/ё/g, "е");

function stem(word: string): string | null {
  const list = /[а-яёўқғҳ]/.test(word) ? SUFFIXES_CYR : SUFFIXES_UZ;
  for (const suf of list) {
    if (word.endsWith(suf) && word.length - suf.length >= 4) return word.slice(0, -suf.length);
  }
  return null;
}

/**
 * @param text foydalanuvchi yozgan matn
 * @param placeNames tushunilgan hudud va tuman nomlari (har tilda) — ularning birinchi so'zi bilan boshlanadigan bo'laklar tashlanadi
 * @param limit ko'pi bilan nechta nomzod (so'z va o'zaklar birga)
 */
export function textKeywords(text: string, placeNames: string[] = [], limit = 4): string[] {
  const places = placeNames
    .map((n) => normalize(n).split(/[^\p{L}']+/u)[0] ?? "")
    .filter((n) => n.length >= 4);
  const words = normalize(text)
    .split(/[^\p{L}']+/u)
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter((w) => w.length >= 3 && !STOP.has(w) && !places.some((p) => w.startsWith(p)));
  const unique = [...new Set(words)].sort((a, b) => b.length - a.length);
  const out: string[] = [];
  for (const w of unique) {
    for (const cand of [w, stem(w)]) {
      if (cand && !STOP.has(cand) && !out.includes(cand)) out.push(cand);
    }
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}
