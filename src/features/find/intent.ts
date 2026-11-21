import { normalizeText } from "@/features/search/understand";

export type FindMode = "jobs" | "workers";

/**
 * "Buxgalter kerak" → ishchi qidiryapti (workers); "Buxgalterlik bo'yicha ish kerak" → ish qidiryapti (jobs).
 * O'zbek (lotin/kirill) va rus tilidagi odatiy iboralar. Aniqlab bo'lmasa — null (foydalanuvchidan bitta savol so'raladi).
 */
const JOB_PATTERNS: RegExp[] = [
  /\bish\s+(kerak|qidir|izla|bormi|bor|top)/, // ish kerak, ish qidiryapman
  // "men elektrikman", "haydovchiman" — kesim: o'zi shu kasb egasi (ega, 2026-11-21: AI rolni o'zi aniqlasin).
  // Fe'llar emas: "qidiryapman", "izlayman", "qilaman" (…yapman / …ayman / …aman)
  /\b(?!\S*(?:yap|[ay])man\b)\S{3,}man\b/,
  /\bya\s+(?!ishchu|ishu|ischu|xochu|hochu|ishem)\S{4,}/, // я водитель
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
  // "elektrik qidiryapman", "haydovchi izlayapmiz" ("ish qidiryapman" — yuqorida, ish qidirish)
  /\b(qidir|izla)\S*/,
];

/**
 * E'lon berish niyati ("vakansiya joylamoqchiman", "o'zim haqimda e'lon bermoqchiman"): kim uchun — "employer" (vakansiya),
 * "worker" (o'zi haqida) yoki null (e'lon deyilgan, kimligi aniq emas — rejimdan olinadi). Qidiruv emas.
 */
export function detectPostIntent(text: string): { who: "worker" | "employer" | null } | null {
  const s = normalizeText(text);
  if (!s) return null;
  const verb = /(joyla|qo'?y|chiqar|ber(moqchi|aman|ish|ay)|razmest|podat|dat\b|post)\S*/;
  if (/\b(vakansiya|vakansii|vakansiyu)\S*/.test(s) && verb.test(s)) return { who: "employer" };
  if (/\b(o'?zim|ozim)\s+(haqimda|haqida)\b/.test(s)) return { who: "worker" };
  if (/\b(e'?lon|elon|obyavlen)\S*/.test(s) && verb.test(s)) return { who: null };
  return null;
}

/** E'lon niyatining o'z so'zlari ("vakansiya joylamoqchiman", "o'zim haqimda e'lon bermoqchiman") va bog'lovchilar */
const POST_WORD =
  /^(vakansiya\S*|vakansii\S*|vakansiyu|e'?lon\S*|elon\S*|obyavlen\S*|o'?zim|ozim|haqimda|haqida|joyla\S*|qo'?y\S*|chiqar\S*|ber(moqchi|aman|ish|ay|ib)\S*|razmest\S*|podat\S*|dat|post\S*|bitta|yangi|ham|men|menga|biz|bizga|uchun|qilib|kerak|edi|salom|assalomu|alaykum)$/;

/**
 * E'lon niyatidan qolgan mazmun (kasb, joy): "Men oshpazman, o'zim haqimda e'lon bermoqchiman" → "Men oshpazman";
 * "Vakansiya joylamoqchiman" → "" (e'lon yordamchisi bo'sh gap bilan boshlanmasin — o'zi "Qanday ish qilasiz?" deb so'raydi).
 */
export function postTopic(text: string): string {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const keep = words.filter((w) => {
    const n = normalizeText(w).replace(/[^a-z']/g, "");
    return n.length > 0 && !POST_WORD.test(n);
  });
  const rest = keep.join(" ").replace(/^[\s,.;:!?—-]+|[\s,.;:!?—-]+$/g, "");
  return keep.some((w) => normalizeText(w).replace(/[^a-z']/g, "").length >= 3) ? rest : "";
}

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
    "job jobs need needed hire hiring for a an the in looking " +
    // olmoshlar va salomlashuv ("men instruktorman menga ish kerak": "men" inglizcha "men's" kasbiga tushib qolmasin)
    "men sen siz biz ular mening meni menda bizning bizni iltimos salom assalomu alaykum " +
    // uzun gapdagi to'ldiruvchi so'zlar (maosh, tajriba, vaqt, hudud so'zlari) — kasb emas; ular bo'laklar ro'yxatini to'ldirib,
    // haqiqiy kasb so'zini siqib chiqarardi (QA, 2026-11-21: "Toshkentda sotuvchi ish kerak, tajribam 2 yil, oylik kamida
    // 4 million, Chilonzor yoki Yunusobod…" — "sotuvchi" umuman qidirilmasdi). "soat" ("soat ustasi") va "grafik"
    // ("grafik dizayner") ataylab yo'q.
    "tajriba tajribam tajribasi tajribasiz kamida oylik maosh maoshi million ming so'm som sum yil yildan kun kunlik " +
    "hafta haftasiga haftada tuman tumani tumanida bo'lsa bolsa bo'lsin mumkin gacha sifatida ishlayman " +
    "opit opita opitom goda god let zarplata zarplatoy oklad tisyach mln rayon rayona rayone ryadom ili gde xochu rabotat " +
    "mojno jelatelno nedelyu nedelya dney chasov"
  ).split(" "),
);

/** Uzun gap: bundan ko'p so'z qolsa, avval bitta so'zlar (ular kesilib qolmasin), keyin ikki so'zli bo'laklar */
const LONG_TEXT_WORDS = 4;
const MAX_CANDIDATES = 14;

/** Qo'shimchalar: "buxgalterlik" → "buxgalter", "haydovchilar" → "haydovchi", "Toshkentda" → "toshkent" */
// "-man/-miz" (kesim: "instruktorman" — "men instruktorman", "oshpazmiz") ham — o'zak bilan birga asl so'z ham qidiriladi
const SUFFIXES = ["chilikka", "chiligi", "chilik", "likka", "ligi", "lik", "larni", "larga", "larda", "lari", "lar", "man", "miz", "ni", "ga", "da", "dan", "ning", "a", "u", "om", "ov"];

/** "-lik/-chilik" (kasb nomidan yasalgan so'z): kelishik qo'shimchasidan keyin ham olib tashlanadi */
const DERIVED = ["chilik", "lik"];

export function stripSuffix(token: string): string[] {
  const out: string[] = [];
  for (const suf of SUFFIXES) {
    if (token.length - suf.length >= 4 && token.endsWith(suf)) out.push(token.slice(0, -suf.length));
  }
  // qo'shma qo'shimcha: "kuryerlikdan" → "kuryerlik" → "kuryer", "oshpazlikka" → "oshpaz" (aks holda "kuryerlik" so'zi
  // "Kuryerlik xizmati dispetcheri" kasbiga tushib qolardi)
  for (const stem of [...out]) {
    for (const suf of DERIVED) {
      if (stem.length - suf.length >= 4 && stem.endsWith(suf)) out.push(stem.slice(0, -suf.length));
    }
  }
  return [...new Set(out)];
}

/** Rus/kirill so'zlari asl yozuvida ham qidiriladi (ruscha nomlar bazada kirillcha): "водителем" → "водител" */
const CYR_STOP = new Set(
  (
    "нужен нужна нужно нужны требуется требуются ищу ищем работа работу работы вакансия вакансии в на для и или с по кк керак иш ишчи " +
    // олмошлар ва саломлашув ("мен ўқитувчиман": "мен" "менеджер"га ўхшаб қолмасин — ega, 2026-11-17)
    "мен менга мени менинг сен сиз биз бизга улар я мне меня мой моя мы вы салом ассалому алайкум здравствуйте привет " +
    // to'ldiruvchi so'zlar (yuqoridagi STOP bilan bir xil sabab)
    "опыт опыта опытом года год лет зарплата зарплатой оклад тысяч млн район района районе рядом или где хочу работать " +
    "можно желательно неделю неделя дней часов тажриба тажрибам ойлик маош минг сўм йил кун ҳафта ҳафтасига туман тумани бўлса камида"
  ).split(" "),
);
// "-ман/-миз" (кесим: "ўқитувчиман") — ўзаги ҳам қидирилади
const CYR_SUFFIXES = ["ами", "ями", "ого", "ему", "ман", "миз", "ом", "ем", "ой", "ей", "ах", "ях", "ам", "ям", "а", "я", "у", "ю", "ы", "и", "е"];

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
  const pairs: string[] = [];
  for (let i = 0; i < words.length - 1; i++) pairs.push(`${words[i]} ${words[i + 1]}`);
  const singles = words.flatMap((w) => [w, ...stripSuffix(w)]);
  const cyr = cyrillicCandidates(text);
  // qisqa so'rov ("bosh buxgalter kerak"): to'liq ibora → juftlar → bitta so'zlar. Uzun gapda to'liq ibora hech qachon kasb
  // nomi emas, juftlar esa ro'yxatni to'ldirib, bitta so'zli kasbni ("sotuvchi") chiqarib yuborardi — avval bitta so'zlar.
  const out =
    words.length > LONG_TEXT_WORDS
      ? [...singles, ...cyr, ...pairs]
      : [...(words.length > 1 ? [words.join(" ")] : []), ...pairs, ...singles, ...cyr];
  return [...new Set(out)].slice(0, MAX_CANDIDATES);
}

/**
 * Hudud nomi kasb sifatida qidirilmasin: tushunilgan viloyat/tuman nomining so'zlaridan (qo'shimchasi bilan yoki qo'shimchasiz)
 * iborat bo'lak kasb nomzodi bo'lmaydi. Aks holda "Samarqandda" so'zi "Samarqand qog'ozi ustasi" kasbiga o'xshab ketadi va
 * hech qanday kasb aytilmagan so'rov kasbli bo'lib qoladi. Boshqa so'z qatnashgan bo'lak ("samarqand qog'ozi ustasi") qoladi.
 */
export function withoutPlaceOnly(candidates: string[], placeNames: string[]): string[] {
  const placeWords = placeNames
    .flatMap((n) => normalizeText(n).split(" "))
    // ruscha sifat shakli: "samarkandskaya" → "samarkand" ("в Самарканде" shu o'zakdan)
    .flatMap((w) => [w, w.replace(/(skiy|skaya|skoe|skogo|skoy)$/, "")])
    .filter((w) => w.length >= 4);
  if (!placeWords.length) return candidates;
  // "samarqandda" — nom + qo'shimcha; "samarkande" (ruscha kelishik) — nomning oxirgi harflarisiz boshi bilan solishtiriladi
  const isPlaceWord = (w: string) => placeWords.some((pw) => pw.startsWith(w) || w.startsWith(pw.slice(0, Math.max(4, pw.length - 2))));
  return candidates.filter((c) => normalizeText(c).split(" ").some((w) => w.length >= 3 && !isPlaceWord(w)));
}
