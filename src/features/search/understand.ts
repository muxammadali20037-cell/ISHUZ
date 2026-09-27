/**
 * Qidiruv matnini tushunish (AI'siz, deterministik): "chilonzorda kechki smenaga kassir 5 mln"
 * → kasb (Kassir), tuman (Chilonzor), grafik (smena), maosh (5 000 000 dan).
 *
 * - O'zbek lotin / kirill / rus tillari: hammasi bitta lotin ko'rinishiga keltiriladi (transliteratsiya).
 * - Kasb nomi, admin kiritgan sinonimlar (subcategories.aliases), qo'shimchalar ("-da", "-lar", "-ga", "-а") hisobga olinadi.
 * - Tushunilmagan so'zlar `rest` ga qoladi — ular oddiy matn qidiruvida ishlatiladi.
 * Sof modul (runtime import yo'q) — vitest bilan testlanadi.
 */

export type ScheduleKey = "5_2" | "6_1" | "2_2" | "shift" | "flexible";
export type EmploymentKey = "full_time" | "part_time" | "temporary" | "freelance" | "internship";
export type SalaryKind = "monthly" | "daily" | "hourly";

export interface NamedRef {
  id: string;
  slug: string;
  name_uz: string;
  name_ru: string;
}
export interface UnderstandRefs {
  categories: readonly NamedRef[];
  subcategories: readonly (NamedRef & { category_id: string; aliases?: readonly string[] | null })[];
  regions: readonly NamedRef[];
  districts: readonly (NamedRef & { region_id: string })[];
}

export interface Understood {
  category: NamedRef | null;
  subcategory: NamedRef | null;
  region: NamedRef | null;
  districts: NamedRef[];
  salaryMin: number | null;
  salaryKind: SalaryKind | null;
  schedules: ScheduleKey[];
  employment: EmploymentKey[];
  remote: boolean;
  noExperience: boolean;
  /** "3 yil tajriba", "2 yildan ko'p", "опытный" → oy */
  experienceMonths: number | null;
  /** Tushunilmagan so'zlar (asl yozilishida) — matn qidiruvi uchun */
  rest: string;
  /** Biror narsa tushunildimi */
  any: boolean;
}

// ---------------------------------------------------------------------------
// Normallashtirish
// ---------------------------------------------------------------------------

const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n",
  о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "",
  э: "e", ю: "yu", я: "ya", ў: "o'", қ: "q", ғ: "g'", ҳ: "h",
};

/** Kichik harf, kirill → lotin, apostroflar bir xil, tinish belgilari → bo'shliq */
export function normalizeText(input: string): string {
  let s = input.toLowerCase().replace(/[’‘`ʻʼ´]/g, "'");
  s = s.replace(/[а-яёўқғҳ]/g, (ch) => CYR[ch] ?? ch);
  // "o'" va "g'" ni bitta harf sifatida saqlaymiz, qolgan apostroflar olib tashlanadi
  s = s.replace(/([og])'/g, "$1\u0001").replace(/'/g, "").replace(/\u0001/g, "'");
  s = s.replace(/(\d)[.,](\d)/g, "$1.$2").replace(/(\d) (?=\d{3}(\D|$))/g, "$1");
  s = s.replace(/[^a-z0-9'.$/+ ]+/g, " ");
  // xalq yozuvidagi farqlar: "h" / "x" (xodim/hodim) — qidiruvda farq qilmasin
  return s.replace(/\s+/g, " ").trim();
}

function tokens(s: string): string[] {
  return s.split(" ").filter(Boolean);
}

/** Yumshoq solishtirish uchun: x→h, yumshoq tovushlar birlashtiriladi */
function soft(t: string): string {
  return t.replace(/x/g, "h").replace(/'/g, "").replace(/shch/g, "sh").replace(/ts/g, "s").replace(/iy$/, "i");
}

/** O'zbek va rus qo'shimchalari: so'z boshi mos kelib, qolgani shulardan biri bo'lsa — mos */
const SUFFIXES = [
  "", "lar", "larni", "larga", "larda", "lari", "ni", "ga", "ka", "qa", "da", "ta", "dagi", "dan", "ning", "i", "si", "imiz", "ingiz",
  "lik", "ligi", "likka", "chi", "chilar", "a", "u", "e", "y", "om", "em", "ov", "ey", "ya", "yu", "iy", "ogo", "ami", "am", "ax", "ah",
];

function tokenMatches(token: string, word: string): boolean {
  if (token === word) return true;
  const t = soft(token);
  const w = soft(word);
  if (t === w) return true;
  if (w.length < 4 || !t.startsWith(w)) return false;
  return SUFFIXES.includes(t.slice(w.length));
}

// ---------------------------------------------------------------------------
// Kalit so'zlar
// ---------------------------------------------------------------------------

const STOP = new Set(
  normalizeText(
    "kerak kerakli ish ishi ishlar ishga ish bor bormi uchun menga bizga qidiryapman qidiraman topish vakansiya vakansiyalar " +
      "va yoki bilan bo'yicha joy joyi xodim hodim ishchi odam " +
      "работа работу нужен нужна нужно нужны требуется требуются вакансия вакансии ищу в на для и или с по",
  ).split(" "),
);

type Rule = { words: string[]; apply: (u: Understood) => void };

const RULES: Rule[] = [
  { words: ["tajribasiz", "tajriba shart emas", "tajriba talab qilinmaydi", "без опыта", "опыт не нужен", "bez opyta"], apply: (u) => void (u.noExperience = true) },
  { words: ["uydan", "uyda", "masofaviy", "masofadan", "onlayn ish", "удаленно", "удалённо", "удаленная", "удалённая", "из дома", "remote", "udalyonka", "udalenka"], apply: (u) => void (u.remote = true) },
  { words: ["kechki", "kechqurun", "tungi", "tunda", "smena", "smenali", "вечерняя", "вечером", "ночная", "ночью", "смена", "сменный", "посменно"], apply: (u) => addUnique(u.schedules, "shift") },
  { words: ["2/2", "2 2", "ikki kun ish ikki kun dam"], apply: (u) => addUnique(u.schedules, "2_2") },
  { words: ["5/2", "besh kunlik"], apply: (u) => addUnique(u.schedules, "5_2") },
  { words: ["6/1", "olti kunlik"], apply: (u) => addUnique(u.schedules, "6_1") },
  { words: ["erkin grafik", "moslashuvchan", "гибкий", "свободный график"], apply: (u) => addUnique(u.schedules, "flexible") },
  { words: ["yarim stavka", "yarim kun", "yarim kunlik", "part time", "part-time", "qo'shimcha ish", "подработка", "неполный день", "полставки", "частичная занятость"], apply: (u) => addUnique(u.employment, "part_time") },
  { words: ["to'liq kun", "to'liq stavka", "полный день", "full time"], apply: (u) => addUnique(u.employment, "full_time") },
  { words: ["vaqtincha", "vaqtinchalik", "mavsumiy", "временная", "временно", "сезонная"], apply: (u) => addUnique(u.employment, "temporary") },
  { words: ["frilans", "freelance", "фриланс"], apply: (u) => addUnique(u.employment, "freelance") },
  { words: ["amaliyot", "stajirovka", "стажировка", "стажер", "стажёр", "intern", "internship"], apply: (u) => addUnique(u.employment, "internship") },
  { words: ["talaba", "talabalar", "talabaga", "студент", "студентов", "для студентов"], apply: (u) => void (u.noExperience = true) },
];

const DAILY = ["kunlik", "kuniga", "bir kunga", "в день", "за день", "дневная", "посуточно"].map(normalizeText);
const HOURLY = ["soatiga", "soatlik", "в час", "за час", "почасовая"].map(normalizeText);

function addUnique<T>(list: T[], v: T) {
  if (!list.includes(v)) list.push(v);
}

// ---------------------------------------------------------------------------
// Ibora qidirish (bir nechta so'zli)
// ---------------------------------------------------------------------------

interface Phrase<T> {
  words: string[];
  value: T;
}

function phrase<T>(text: string, value: T): Phrase<T> | null {
  const words = tokens(normalizeText(text));
  const joined = words.join("");
  if (!words.length || (joined.length < 3 && !/\d/.test(joined))) return null;
  return { words, value };
}

/** Eng uzun mos iborani topadi; topilgan so'zlar `used` ga belgilanadi */
function findPhrase<T>(toks: string[], used: boolean[], phrases: Phrase<T>[]): T | null {
  let best: { value: T; start: number; len: number; exact: boolean } | null = null;
  for (const p of phrases) {
    const n = p.words.length;
    for (let i = 0; i + n <= toks.length; i++) {
      let ok = true;
      let exact = true;
      for (let k = 0; k < n; k++) {
        if (used[i + k]) {
          ok = false;
          break;
        }
        const tok = toks[i + k] ?? "";
        const word = p.words[k] ?? "";
        if (tok === word) continue;
        // faqat oxirgi so'z qo'shimcha olishi mumkin (o'rtadagilari aynan / yumshoq mos)
        if (k === n - 1 ? tokenMatches(tok, word) : soft(tok) === soft(word)) {
          exact = false;
          continue;
        }
        ok = false;
        break;
      }
      if (!ok) continue;
      const better = !best || n > best.len || (n === best.len && exact && !best.exact);
      if (better) best = { value: p.value, start: i, len: n, exact };
    }
  }
  if (!best) return null;
  for (let k = 0; k < best.len; k++) used[best.start + k] = true;
  return best.value;
}

// ---------------------------------------------------------------------------
// Maosh
// ---------------------------------------------------------------------------

const MLN = new Set(["mln", "million", "mil", "m", "mlrd", "millon"].map(normalizeText).concat(["mln.", "млн"].map(normalizeText)));
const THOUSAND = new Set(["ming", "k", "tis", "tisyach", "тыс", "тысяч", "тысячи"].map(normalizeText));
const USD_RATE = 12_800;

function parseSalary(toks: string[], used: boolean[], u: Understood) {
  for (let i = 0; i < toks.length; i++) {
    if (used[i]) continue;
    const m = /^(\$)?(\d+(?:\.\d+)?)(mln|m|k|ming|\$)?$/.exec(toks[i] ?? "");
    if (!m) continue;
    let n = Number.parseFloat(m[2] ?? "");
    if (!Number.isFinite(n) || n <= 0) continue;
    let unit = m[3] ?? "";
    let consumedNext = false;
    const next = toks[i + 1];
    if (!unit && next && (MLN.has(next) || THOUSAND.has(next) || next === "$" || next === "dollar" || next === "dollor")) {
      unit = next;
      consumedNext = true;
    }
    const usd = m[1] === "$" || unit === "$" || unit === "dollar" || unit === "dollor";
    if (usd) n *= USD_RATE;
    else if (MLN.has(unit)) n *= 1_000_000;
    else if (THOUSAND.has(unit)) n *= 1_000;
    else if (n < 100_000) continue; // "2/2", "3 yil", "10 dan 22 gacha" — maosh emas
    if (n < 10_000 || n > 1_000_000_000) continue;
    u.salaryMin = Math.round(n);
    used[i] = true;
    if (consumedNext) used[i + 1] = true;
    // "dan", "dan yuqori", "от" — shunchaki bog'lovchi
    for (const j of [i - 1, i + (consumedNext ? 2 : 1), i + (consumedNext ? 3 : 2)]) {
      if (j >= 0 && j < toks.length && !used[j] && ["dan", "ot", "kamida", "yuqori", "ko'p", "baland", "vishe", "bolee", "gacha", "so'm", "som", "sum", "rub"].includes(toks[j] ?? "")) used[j] = true;
    }
    return;
  }
}

// ---------------------------------------------------------------------------
// Tajriba
// ---------------------------------------------------------------------------

const YEAR_WORDS = ["yil", "yillik", "yildan", "yilgacha", "yillar", "god", "goda", "let"];
const EXPERIENCED = ["tajribali", "tajribasi bor", "opitniy", "s opitom", "опытный", "с опытом"].map(normalizeText);

function parseExperience(toks: string[], used: boolean[], u: Understood) {
  for (let i = 0; i < toks.length - 1; i++) {
    if (used[i] || used[i + 1]) continue;
    const n = Number.parseFloat(toks[i] ?? "");
    const unit = toks[i + 1] ?? "";
    if (!Number.isFinite(n) || n <= 0 || n > 40 || !YEAR_WORDS.includes(unit)) continue;
    u.experienceMonths = Math.round(n * 12);
    used[i] = used[i + 1] = true;
    for (const j of [i + 2, i + 3]) {
      if (j < toks.length && !used[j] && ["tajriba", "tajribali", "tajribasi", "ko'p", "ortiq", "opit", "opita", "staj", "i", "bolee"].includes(toks[j] ?? "")) used[j] = true;
    }
    return;
  }
  if (!u.noExperience && EXPERIENCED.some((w) => findPhrase(toks, used, [{ words: tokens(w), value: true }]))) u.experienceMonths = 12;
}

// ---------------------------------------------------------------------------
// Asosiy funksiya
// ---------------------------------------------------------------------------

export function emptyUnderstood(): Understood {
  return { category: null, subcategory: null, region: null, districts: [], salaryMin: null, salaryKind: null, schedules: [], employment: [], remote: false, noExperience: false, experienceMonths: null, rest: "", any: false };
}

/** "Юнусабадский район" → "yunusabad", "Самаркандская область" → "samarkand" */
function ruBase(name: string): string {
  return normalizeText(name)
    .replace(/(skiy|skaya|skoe|skogo|skoy)\b/g, "")
    .replace(/\b(rayon|oblast|gorod|respublika)\b/g, " ");
}

/** Ma'lumotnoma bo'yicha iboralar lug'ati (bir marta tuzib, qayta ishlatish mumkin) */
export function buildDictionary(refs: UnderstandRefs) {
  const professions: Phrase<{ sub: NamedRef & { category_id: string } | null; cat: NamedRef | null }>[] = [];
  const catById = new Map(refs.categories.map((c) => [c.id, c]));
  for (const s of refs.subcategories) {
    if (s.slug === "other") continue;
    const value = { sub: s, cat: catById.get(s.category_id) ?? null };
    for (const text of [s.name_uz, s.name_ru, ...(s.aliases ?? [])]) {
      // "Haydovchi (B toifa)" → "haydovchi b toifa" va "haydovchi"
      for (const variant of [text, text.replace(/\(.*?\)/g, " ")]) {
        const p = phrase(variant, value);
        if (p) professions.push(p);
      }
    }
  }
  for (const c of refs.categories) {
    if (c.slug === "other") continue;
    for (const text of [c.name_uz, c.name_ru]) {
      const p = phrase(text, { sub: null, cat: c });
      if (p) professions.push(p);
    }
  }
  const places: Phrase<{ kind: "region" | "district"; ref: NamedRef & { region_id?: string } }>[] = [];
  for (const r of refs.regions) {
    for (const text of [r.name_uz, r.name_ru, r.name_uz.replace(/\b(viloyati|shahri|respublikasi)\b/gi, " "), ruBase(r.name_ru)]) {
      const p = phrase(text, { kind: "region" as const, ref: r });
      if (p) places.push(p);
    }
  }
  for (const d of refs.districts) {
    for (const text of [d.name_uz, d.name_ru, d.name_uz.replace(/\b(tumani|shahri)\b/gi, " "), ruBase(d.name_ru)]) {
      const p = phrase(text, { kind: "district" as const, ref: d });
      if (p) places.push(p);
    }
  }
  const rules = RULES.flatMap((r) => r.words.map((w) => phrase(w, r.apply)).filter((p): p is Phrase<Rule["apply"]> => !!p));
  return { professions, places, rules, regions: refs.regions };
}
export type SearchDictionary = ReturnType<typeof buildDictionary>;

export function understandQuery(query: string, dict: SearchDictionary): Understood {
  const u = emptyUnderstood();
  const original = query.replace(/\s+/g, " ").trim();
  const norm = normalizeText(original);
  const toks = tokens(norm);
  if (!toks.length) return u;
  const used = toks.map(() => false);

  // 1. Qoidalar (grafik, bandlik, masofaviy, tajribasiz) — uzun iboralar birinchi
  for (;;) {
    const apply = findPhrase(toks, used, dict.rules);
    if (!apply) break;
    apply(u);
  }
  // 2. Tajriba ("3 yil"), keyin maosh turi va miqdori
  parseExperience(toks, used, u);
  const kindOf = (list: string[]) => list.some((w) => findPhrase(toks, used, [{ words: tokens(w), value: true }]));
  if (kindOf(DAILY)) u.salaryKind = "daily";
  else if (kindOf(HOURLY)) u.salaryKind = "hourly";
  parseSalary(toks, used, u);
  if (u.salaryMin && !u.salaryKind) u.salaryKind = "monthly";
  if (!u.salaryMin) u.salaryKind = u.salaryKind === "daily" || u.salaryKind === "hourly" ? u.salaryKind : null;

  // 3. Joy (tuman/viloyat) — bir nechta tuman bo'lishi mumkin
  for (;;) {
    const place = findPhrase(toks, used, dict.places);
    if (!place) break;
    if (place.kind === "district") {
      if (!u.districts.some((d) => d.id === place.ref.id)) u.districts.push(place.ref);
      const region = dict.regions.find((r) => r.id === place.ref.region_id);
      if (region && !u.region) u.region = region;
    } else if (!u.region) {
      u.region = place.ref;
    }
  }
  // Tumanlar boshqa viloyatdan bo'lsa — faqat viloyatga mos kelganlari qoladi
  if (u.region) u.districts = u.districts.filter((d) => !("region_id" in d) || (d as { region_id?: string }).region_id === u.region!.id);

  // 4. Kasb (eng uzun mos ibora)
  const prof = findPhrase(toks, used, dict.professions);
  if (prof) {
    u.category = prof.cat;
    u.subcategory = prof.sub;
  }

  // 5. Qolgan so'zlar (asl yozilishida qaytariladi)
  const originalToks = tokens(original.replace(/[,;!?]+/g, " "));
  const restNorm = toks.filter((t, i) => !used[i] && !STOP.has(t));
  u.rest =
    originalToks.length === toks.length
      ? originalToks.filter((_, i) => !used[i] && !STOP.has(toks[i] ?? "")).join(" ")
      : restNorm.join(" ");

  u.any = !!(u.category || u.region || u.districts.length || u.salaryMin || u.schedules.length || u.employment.length || u.remote || u.noExperience || u.experienceMonths !== null);
  return u;
}
