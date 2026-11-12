/**
 * Bozor statistikasi hisobi (sof modul — testlanadi). Faqat haqiqiy faol e'lonlardagi oylik maosh: "kelishiladi" va
 * kunlik/soatlik maoshlar oylikka aylantirilmaydi (taxmin bo'lardi). Namuna kichik bo'lsa (3 tadan kam) — oraliq
 * ko'rsatilmaydi: bitta-ikkita e'londan "o'rtacha maosh" chiqarish chalg'itadi.
 */
export interface SalaryRow {
  salary_from: number | null;
  salary_to: number | null;
  salary_type: string;
  salary_negotiable: boolean;
}

export interface SalarySummary {
  /** hisobga olingan e'lonlar soni */
  n: number;
  min: number;
  median: number;
  max: number;
}

export const MIN_SALARY_SAMPLE = 3;

type Names = { uz: string; ru: string; en: string | null };

/** Kasb (va ixtiyoriy hudud) bo'yicha bozor holati — faqat bazadagi haqiqiy faol e'lonlardan (server: market.ts) */
export interface MarketStats {
  profession: Names;
  region: Names | null;
  /** faol vakansiyalar soni (ommaviy qidiruv qoidalari bilan) */
  vacancies: number;
  /** ochiq ish izlovchi e'lonlari soni */
  seekers: number;
  /** oylik maosh oralig'i (kamida 3 ta e'lon bo'lsa) */
  salary: SalarySummary | null;
  /** shu kasb (va hudud) bo'yicha vakansiyalar va nomzodlar ro'yxati */
  jobsHref: string;
  workersHref: string;
}

export type StatsLang = "uz" | "oz" | "ru" | "en";

/** Maosh yozuvi: 4 500 000 → "4,5 mln so'm" / "4,5 млн сум" / "4.5M UZS"; 800 000 → "800 ming so'm" */
export function formatSum(value: number, lang: StatsLang): string {
  const mln = value >= 1_000_000;
  const n = mln ? Math.round(value / 100_000) / 10 : Math.round(value / 1_000);
  const num = lang === "en" ? String(n) : String(n).replace(".", ",");
  if (lang === "en") return `${num}${mln ? "M" : "K"} UZS`;
  if (lang === "ru") return `${num} ${mln ? "млн" : "тыс."} сум`;
  if (lang === "oz") return `${num} ${mln ? "млн" : "минг"} сўм`;
  return `${num} ${mln ? "mln" : "ming"} so'm`;
}

/** Kasb yoki hudud nomi so'zlashuv tilida (kirill o'zbekchada — chaqiruvchi o'giradi) */
export function localName(names: Names, lang: StatsLang): string {
  return lang === "ru" ? names.ru : lang === "en" ? (names.en ?? names.uz) : names.uz;
}

const round100k = (x: number) => Math.round(x / 100_000) * 100_000;

export function summarizeSalaries(rows: SalaryRow[]): SalarySummary | null {
  const values = rows
    .filter((r) => r.salary_type === "monthly" && !r.salary_negotiable)
    .map((r) => (r.salary_from && r.salary_to ? (r.salary_from + r.salary_to) / 2 : (r.salary_from ?? r.salary_to)))
    .filter((v): v is number => typeof v === "number" && v >= 100_000 && v <= 500_000_000)
    .sort((a, b) => a - b);
  if (values.length < MIN_SALARY_SAMPLE) return null;
  const mid = values.length / 2;
  const median = values.length % 2 ? values[Math.floor(mid)]! : (values[mid - 1]! + values[mid]!) / 2;
  return { n: values.length, min: round100k(values[0]!), median: round100k(median), max: round100k(values.at(-1)!) };
}

/**
 * Statistika savolidan kasb va joyni ajratish: "maosh", "qancha", "talab", "statistika", "сколько", "average" kabi so'zlar
 * olib tashlanadi — aks holda ular kasb deb tushunilardi ("talab" → "Talabalar uchun ish", "statistika" → "Statistika
 * mutaxassisi"). Bo'sh qolsa — kasb aytilmagan (yordamchi so'raydi).
 */
const STATS_WORDS = new Set(
  [
    // o'zbekcha (lotin)
    "maosh", "maoshi", "maoshlari", "maoshni", "maoshlar", "maoshlarni", "oylik", "oyligi", "oyliklari", "oylikni", "oyliklar", "haqi", "haqqi",
    "qancha", "qanchadan", "qanchaga", "necha", "nechta", "o'rtacha", "ortacha", "o'rtasi", "statistika", "statistikasi", "statistikani", "statistik",
    "mehnat", "bozor", "bozori", "bozorda", "bozordagi", "bozorni", "talab", "talabi", "talablar", "bormi", "katta", "kattami", "qanday",
    "qandayligi", "raqobat", "raqobati", "kasbim", "kasbimga", "kasbimni", "kasb", "kasbi", "mening", "menga", "bo'yicha", "boyicha", "va",
    "oladi", "olishadi", "topadi", "topishadi", "topaman", "olaman", "ishlaydi", "to'laydi", "to'lashadi", "to'lov", "pul", "taklif", "qilay",
    "qilsam", "ko'rsating", "ko'rsat", "ko'rsatib", "bering", "xodimga", "xodim", "ishchiga", "so'm", "sum", "bo'ladi", "bo'lsam", "bo'lib",
    "ish", "ishi", "ishlar", "ishlari", "e'lon", "e'lonlar", "vakansiya", "vakansiyalar", "nomzod", "nomzodlar", "ko'p", "kam", "yaxshi", "-chi", "chi",
    // o'zbekcha (kirill)
    "маош", "маоши", "маошлари", "маошни", "ойлик", "ойлиги", "ойликлари", "ҳақи", "қанча", "нечта", "неча", "ўртача", "статистика",
    "статистикаси", "меҳнат", "бозор", "бозори", "бозордаги", "талаб", "талаби", "борми", "катта", "қандай", "рақобат", "касбим", "касб",
    "менинг", "менга", "бўйича", "ва", "олади", "топади", "тўлайди", "пул", "таклиф", "қилай", "кўрсатинг", "ходимга", "ходим", "иш", "иши",
    "сўм",
    // русский
    "сколько", "платят", "платит", "получает", "получают", "зарабатывает", "зарабатывают", "зарплата", "зарплату", "зарплаты", "зарплатой",
    "зарплат", "средняя", "средние", "среднюю", "средний", "средней", "среднего", "оклад", "заработок", "статистика", "статистику", "рынок",
    "рынке", "рынка", "труда", "спрос", "на", "по", "моей", "моя", "мой", "профессии", "профессия", "какой", "какая", "какую", "и", "есть",
    "ли", "конкуренция", "вакансий", "вакансии", "кандидатов", "соискателей", "предложить", "сотруднику", "покажите", "покажи", "сум", "работа",
    "работы", "у",
    // English
    "how", "much", "many", "do", "does", "is", "are", "can", "will", "would", "a", "an", "the", "earn", "earns", "make", "makes", "get", "gets",
    "paid", "pay", "salary", "salaries", "wage", "wages", "average", "median", "of", "for", "statistics", "stats", "labour", "labor", "market",
    "demand", "competition", "vacancies", "jobs", "job", "candidates", "my", "profession", "what", "should", "i", "offer", "show", "me", "on",
    "it", "in", "and", "or", "uzs",
  ].map((w) => w.toLowerCase()),
);

export function statsSubject(text: string): string {
  return text
    .replace(/['‘’ʻʼ`´]/g, "'")
    .replace(/-(chi|чи)(?=[\s?!.,]|$)/giu, "")
    .split(/[\s,.!?;:()«»"“”—–]+/u)
    .filter((w) => w && !STATS_WORDS.has(w.toLowerCase()) && !STATS_WORDS.has(w.toLowerCase().replace(/'/g, "")))
    .join(" ")
    .trim();
}
