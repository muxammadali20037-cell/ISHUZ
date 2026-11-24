/**
 * Kasbga qarab savollar (ega, 2026-11-24: "ish topdim aqli odamlarni lol qoldirsin — yozganiga qarab savol bersin, tanlagan
 * kasbiga qarab savol bersin… e'londa jinsi, yoshi (aniq yosh emas — yosh chegaralari), ish vaqti — ish beruvchi uchun, faqat
 * ishga qarab so'ralsin: usta kerak desa — qanaqa ustaligini so'raydi, shunga qarab ish vaqtini so'raydi yoki so'ramaydi").
 *
 *  · har kasbga: jinsi (Erkak / Ayol / Farqi yo'q) va yoshi (chegaralar: 18–25, 18–35, 25–45, 35–55, farqi yo'q yoki o'zi);
 *  · ish vaqti — faqat kerak joyda: masofaviy, bir martalik (usta/quruvchi) va smenali ishda so'ralmaydi;
 *  · kasbga xos qo'shimcha savollar: haydovchi — guvohnoma toifasi va kimning mashinasi; kuryer — transport; tikuvchi — ishbay
 *    yoki oylik; usta/quruvchi — doimiy yoki bir martalik; IT/dizayn — ofisda, masofadan yoki aralash;
 *  · birinchi gapdan tushunilgan narsa ("C toifa", "25–40 yosh", "9 dan 18 gacha", "faqat ayollar") — qayta so'ralmaydi.
 *
 * Sof funksiyalar (mijoz, server va unit testlar uchun).
 */

export type GenderChoice = "male" | "female" | "any";
export const GENDER_CHOICES: readonly GenderChoice[] = ["male", "female", "any"];

/** Yosh chegarasi; ikkalasi null — "farqi yo'q" */
export interface AgeRange {
  min: number | null;
  max: number | null;
}
export const AGE_PRESETS: readonly AgeRange[] = [
  { min: 18, max: 25 },
  { min: 18, max: 35 },
  { min: 25, max: 45 },
  { min: 35, max: 55 },
];
export const AGE_MIN = 14;
export const AGE_MAX = 80;

/** Ish vaqti ("09:00"–"18:00"); null — kelishiladi */
export interface WorkHours {
  from: string;
  to: string;
}
export const HOURS_PRESETS: readonly WorkHours[] = [
  { from: "08:00", to: "17:00" },
  { from: "09:00", to: "18:00" },
  { from: "10:00", to: "19:00" },
];

/**
 * Kasbga xos savollar katalogi (ega, 2026-11-24, keyin: "hamma kasblardan — har bitta bosqich, har bir rol uchun aniq
 * so'rash kerak"). Har soha (kategoriya) — 1–2 ta aniq savol, ish beruvchi va ishchi uchun alohida. Variant matnlari:
 * ish beruvchi — easy.vguide.x.<kalit>.<variant> (e'londagi qatori — line_<variant>), ishchi — easy.guided.wx.<kalit>.….
 * "any", "not_required", "no", "none" — e'longa yozilmaydi (talab emas).
 */
const OPTS = {
  license: ["B", "BC", "C", "CE", "D", "E"],
  car: ["company", "own"],
  transport: ["foot", "bike", "moto", "car", "any"],
  format: ["office", "remote", "hybrid"],
  term: ["permanent", "once"],
  pay: ["piece", "monthly"],
  level: ["junior", "middle", "senior", "any"],
  sales_place: ["store", "market", "wholesale", "online"],
  pay_mode: ["fixed", "fixed_percent", "percent"],
  fin_soft: ["1c", "excel", "any"],
  vehicles: ["light", "truck", "both"],
  venue: ["cafe", "restaurant", "canteen", "fastfood", "banquet"],
  medbook: ["required", "not_required"],
  languages: ["uz", "ru", "uz_ru", "plus_en"],
  teach_place: ["school", "center", "kindergarten", "online", "private"],
  cert: ["required", "not_required"],
  med_place: ["state", "private", "pharmacy", "home"],
  edu: ["higher", "secondary", "any"],
  clean_place: ["office", "home", "mall", "hotel"],
  guard_shift: ["day", "night", "day24"],
  army: ["required", "not_required"],
  machine: ["straight", "overlock", "both"],
  night: ["yes", "no"],
  season: ["seasonal", "permanent"],
  farm_place: ["field", "greenhouse", "livestock", "garden"],
  lawyer_license: ["required", "not_required"],
  degree: ["phd", "master", "any"],
  team: ["small", "medium", "large"],
  cad: ["autocad", "revit", "solidworks", "any"],
  heights: ["yes", "no"],
  el_group: ["g2", "g3", "g4", "g5", "none"],
  vaxta: ["yes", "no"],
} as const;
export type ExtraKey = keyof typeof OPTS;
/** Variantlar (tartibi — tugmalar tartibi) */
export const EXTRA_OPTIONS: Record<ExtraKey, readonly string[]> = OPTS;
export const EXTRA_KEYS = Object.keys(OPTS) as ExtraKey[];
export type Extras = Partial<Record<ExtraKey, string>>;

/** Talab emas — e'lon matniga yozilmaydi */
const SILENT = new Set(["any", "not_required", "no", "none"]);

export function isExtras(x: unknown): x is Extras {
  if (x === undefined) return true;
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  return Object.entries(x as Record<string, unknown>).every(([k, v]) => (EXTRA_KEYS as readonly string[]).includes(k) && typeof v === "string" && EXTRA_OPTIONS[k as ExtraKey].includes(v));
}

/** Kasb ma'lumoti: soha (kategoriya slug) va kasb nomlari (uz/ru — tanlangan tugundan) */
export interface ProfessionContext {
  category: string | null;
  names: string[];
}

const DRIVER_NAME = /(haydovchi|haydovchisi|shofyor|shofer|taksi|ҳайдовчи|хайдовчи|такси|водител|шофер|шофёр|таксист|driver)/iu;
const COURIER_NAME = /(kuryer|kurer|yetkazib|етказиб|курьер|доставщик|доставк|courier|delivery)/iu;
/** fotograf, videograf — ofis/masofa emas, buyurtma (to'y, tadbir): doimiy yoki bir martalik */
const PHOTO_NAME = /(fotograf|фотограф|videograf|видеограф|operator|оператор)/iu;
/** kuryerlik xizmatining ofis xodimlari — transport so'ralmaydi */
const NOT_COURIER = /(dispetcher|supervayzer|operator|menejer|punkt|диспетчер|супервайзер|оператор|менеджер|пункт)/iu;
/** maxsus texnika (avtobus, samosval, traktor…) — mashina kimnikiligi so'ralmaydi (har doim ish beruvchiniki) */
const SPECIAL_VEHICLE = /(avtobus|samosval|traktor|kombayn|forklift|pogruzchik|evakuator|refrijerator|beton|mikser|tez yordam|assenizator|chiqindi|pochta|inkassator|автобус|самосвал|трактор|комбайн|погрузчик|эвакуатор|рефрижератор|бетон|миксер|скорой|ассенизатор|мусор|почтов|инкассатор)/iu;
/** traktor, kombayn, yuklagich — boshqa turdagi guvohnoma (B–E toifa emas) */
const OTHER_LICENSE = /(traktor|kombayn|forklift|pogruzchik|трактор|комбайн|погрузчик)/iu;
/** usta sohasidagi boshqaruv va texnika xodimlari — "o'z asboblari" so'ralmaydi */
const NOT_TOOLS = /(operator|prorab|muhandis|smeta|dispetcher|menejer|оператор|прораб|инженер|смет|диспетчер|менеджер)/iu;
/** ombor va yuk ishchilari (logist, dispetcher emas) — doimiy yoki bir martalik */
const LOADER_NAME = /(yuklovchi|yuk tashuvchi|ombor ishchisi|gruzchik|hammol|грузчик|разнорабоч|кладовщик|складск)/iu;

function driverKeys<K extends "license" | "car">(name: string): K[] {
  const out: ("license" | "car")[] = [];
  if (!OTHER_LICENSE.test(name)) out.push("license");
  if (!SPECIAL_VEHICLE.test(name)) out.push("car");
  return out as K[];
}

/** Ish beruvchi: soha → savollar (tartibi bilan). Haydovchi, kuryer, dizayn, logistika — kasb nomiga qarab (pastda) */
const EMPLOYER_BY_CATEGORY: Partial<Record<string, ExtraKey[]>> = {
  it: ["format", "level"],
  marketing: ["format"],
  sales: ["sales_place", "pay_mode"],
  finance: ["fin_soft"],
  construction: ["term"],
  craftsman: ["term"],
  plumber: ["term"],
  electrician: ["term", "el_group"],
  mechanic: ["night"],
  auto_service: ["vehicles"],
  restaurant: ["venue", "medbook"],
  call_center: ["languages"],
  office: ["languages"],
  hotel: ["languages"],
  education: ["teach_place", "cert"],
  medicine: ["med_place", "edu"],
  cleaning: ["clean_place", "term"],
  security: ["guard_shift", "army"],
  sewing: ["pay", "machine"],
  beauty: ["pay_mode"],
  production: ["night"],
  agriculture: ["farm_place", "season"],
  legal: ["lawyer_license"],
  science: ["degree"],
  management: ["team"],
  government: ["edu"],
  engineering: ["cad"],
  telecom: ["heights"],
  energy: ["el_group"],
  mining: ["vaxta"],
  culture: ["term"],
  real_estate: ["pay_mode"],
  crafts: ["term"],
};

/** Shu kasb uchun qo'shimcha savollar (ish beruvchi; tartibi bilan) */
export function extraKeysFor(p: ProfessionContext): ExtraKey[] {
  const name = p.names.join(" ");
  switch (p.category) {
    case "driver":
      return DRIVER_NAME.test(name) ? driverKeys(name) : [];
    case "courier":
      return COURIER_NAME.test(name) && !NOT_COURIER.test(name) ? ["transport"] : [];
    case "design":
      return PHOTO_NAME.test(name) ? ["term"] : ["format"];
    case "logistics":
      return LOADER_NAME.test(name) ? ["term"] : [];
    default:
      return (p.category && EMPLOYER_BY_CATEGORY[p.category]) || [];
  }
}

/** Kasb nomining o'zidan tushuniladigan javoblar ("C toifa haydovchi" → C; "Piyoda kuryer" → piyoda) */
export function extrasFromName(p: ProfessionContext): Extras {
  const keys = extraKeysFor(p);
  return pickExtras(p.names.join(" "), keys);
}

/** Ish vaqti so'raladimi: masofaviy, bir martalik, smenali/erkin grafik va tungi/sutkalik navbatchilikda — yo'q */
export function hoursRelevant(d: { remote: boolean; extras?: Extras; schedule: string }): boolean {
  if (d.remote) return false;
  if (d.extras?.term === "once") return false;
  if (d.extras?.guard_shift === "night" || d.extras?.guard_shift === "day24") return false;
  return d.schedule !== "shift" && d.schedule !== "flexible";
}

/** Ish grafigi (5/2, 6/1…) so'raladimi: bir martalik ishda — yo'q */
export function scheduleRelevant(d: { extras?: Extras }): boolean {
  return d.extras?.term !== "once";
}

// ------------------------------------------------------------------------------------------------ matndan tushunish

const lower = (s: string) => s.toLowerCase().replace(/[ʻʼ‘’`]/g, "'");

const FEMALE = /(?:^|[^\p{L}])(ayol|ayollar|xotin-?qizlar|qiz|qizlar|qiz bola|опа-?сингил|аёл|аёллар|қиз|қизлар|девушк\p{L}*|женщин\p{L}*|female|woman|women)(?=$|[^\p{L}])(?!\s+(?:kiyim|sartarosh|salon|zal|кийим|сартарош|одежд|парикмахер|салон))/iu;
// "men" (o'zbekcha "men") va "man" — olinmaydi
const MALE = /(?:^|[^\p{L}])(erkak|erkaklar|yigit|yigitlar|эркак|эркаклар|йигит|йигитлар|мужчин\p{L}*|парень|парня|парни|парней|male)(?=$|[^\p{L}])(?!\s+(?:kiyim|sartarosh|salon|zal|кийим|сартарош|одежд|парикмахер|салон))/iu;
const ANY_GENDER = /(jinsi(?:dan qat'i nazar| farqi yo'q| muhim emas)|ayol(?:\s+yoki\s+|\s*\/\s*)erkak|erkak(?:\s+yoki\s+|\s*\/\s*)ayol|любого пола|пол не важен)/iu;

/** "faqat ayollar", "yigit kerak", "девушка" → jinsi; ikkalasi ham bo'lsa yoki "farqi yo'q" — "any" */
export function parseGender(text: string): GenderChoice | null {
  const s = lower(text);
  if (ANY_GENDER.test(s)) return "any";
  const f = FEMALE.test(s);
  const m = MALE.test(s);
  if (f && m) return "any";
  return f ? "female" : m ? "male" : null;
}

const AGE_WORD = "(?:yosh\\p{L}*|ёш\\p{L}*|лет|года|год|years?|y\\.?o\\.?)";
const okAge = (n: number) => n >= AGE_MIN && n <= AGE_MAX;

/** "18-35 yosh", "25 yoshdan 40 yoshgacha", "от 20 до 35 лет", "30 yoshgacha", "18 yoshdan katta" → chegaralar */
export function parseAge(text: string): AgeRange | null {
  const s = lower(text);
  const range = [
    new RegExp(`(\\d{2})\\s*[-–—]\\s*(\\d{2})\\s*${AGE_WORD}`, "iu"),
    new RegExp(`(\\d{2})\\s*(?:yosh|ёш)dan\\s*(\\d{2})\\s*(?:yosh|ёш)?\\s*(?:gacha|гача)`, "iu"),
    new RegExp(`(\\d{2})\\s*(?:dan|дан)\\s*(\\d{2})\\s*(?:yosh|ёш)\\s*(?:gacha|гача)`, "iu"),
    new RegExp(`от\\s*(\\d{2})\\s*до\\s*(\\d{2})\\s*(?:лет|года)`, "iu"),
    new RegExp(`(?:age|aged)\\s*(\\d{2})\\s*[-–—to]+\\s*(\\d{2})`, "iu"),
  ];
  for (const re of range) {
    const m = re.exec(s);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (okAge(a) && okAge(b) && b >= a) return { min: a, max: b };
    }
  }
  const max = new RegExp(`(\\d{2})\\s*(?:yosh|ёш)(?:gacha|гача)|до\\s*(\\d{2})\\s*(?:лет|года)|under\\s*(\\d{2})`, "iu").exec(s);
  if (max) {
    const b = Number(max[1] ?? max[2] ?? max[3]);
    if (okAge(b) && b > 18) return { min: 18, max: b };
  }
  const min = new RegExp(`(\\d{2})\\s*(?:yosh|ёш)(?:dan|дан)\\s*(?:katta|yuqori|oshgan|кат|юқори)|от\\s*(\\d{2})\\s*(?:лет|года)|старше\\s*(\\d{2})|(\\d{2})\\+\\s*${AGE_WORD}`, "iu").exec(s);
  if (min) {
    const a = Number(min[1] ?? min[2] ?? min[3] ?? min[4]);
    if (okAge(a)) return { min: a, max: null };
  }
  return null;
}

const hh = (h: number, m = 0) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
const okHour = (h: number, m = 0) => h >= 0 && h <= 24 && m >= 0 && m < 60 && !(h === 24 && m > 0);

/** "8:00-17:00", "soat 9 dan 18 gacha", "9 dan 18 gacha", "с 9 до 18" → ish vaqti */
export function parseWorkHours(text: string): WorkHours | null {
  const s = lower(text);
  const patterns: RegExp[] = [
    /(\d{1,2})[:.](\d{2})\s*(?:[-–—]|dan|дан|до|to)\s*(\d{1,2})[:.](\d{2})/u,
    /(?:soat|соат)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(?:[-–—]|dan|дан)\s*(\d{1,2})(?:[:.](\d{2}))?/u,
    /(?:^|[^\p{L}\d])с\s*(\d{1,2})(?:[:.](\d{2}))?\s*до\s*(\d{1,2})(?:[:.](\d{2}))?(?!\s*(?:лет|года|тыс|млн|\d))/u,
    /(?:^|[^\d])(\d{1,2})(?:[:.](\d{2}))?\s*(?:dan|дан)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(?:gacha|гача)(?!\s*(?:yosh|ёш|mln|ming|млн|минг))/u,
  ];
  for (const re of patterns) {
    const m = re.exec(s);
    if (!m) continue;
    const [a, am, b, bm] = [Number(m[1]), Number(m[2] ?? 0), Number(m[3]), Number(m[4] ?? 0)];
    if (okHour(a, am) && okHour(b, bm) && (a !== b || am !== bm)) return { from: hh(a, am), to: hh(b === 24 ? 0 : b, bm) };
  }
  return null;
}

/**
 * Gapdan tushunish qoidalari: kalit, qiymat va so'z. Ikki rol uchun qiymati boshqacha bo'lsa — alohida (ish beruvchi:
 * "required", ishchi: "yes"). Faqat shu kasb savollari olinadi (pickExtras / pickWorkerExtras — `keys`).
 */
interface WordRule {
  key: string;
  /** "$" — topilgan harf (guvohnoma toifasi) */
  value: string;
  re: RegExp;
  /** faqat bir rol uchun (berilmasa — ikkalasi) */
  role?: "employer" | "worker";
}
const req = (key: string, re: RegExp): WordRule[] => [
  { key, value: "required", re, role: "employer" },
  { key, value: "yes", re, role: "worker" },
];
const WORDS: WordRule[] = [
  // guvohnoma toifasi: "C toifa", "BC toifali", "категория CE", "права D"
  { key: "license", value: "$", re: /(?:^|[^\p{L}])([bcdeвсде]{1,2})\s*(?:toifa\p{L}*|тоифа\p{L}*|kategoriya\p{L}*|категори\p{L}*|prava|права)/iu },
  { key: "license", value: "$", re: /(?:toifa\p{L}*|тоифа\p{L}*|kategoriya\p{L}*|категори\p{L}*|prava|права)\s*[:-]?\s*["«]?([bcdeвсде]{1,2})(?=$|[^\p{L}])/iu },
  { key: "car", value: "own", role: "employer", re: /(o'z\s+(?:mashina|avto|avtomobil)\p{L}*|shaxsiy\s+(?:mashina|avto|avtomobil)\p{L}*|своим\s+(?:авто|автомобил|машин)\p{L}*|личн\p{L}*\s+(?:авто|автомобил|машин)\p{L}*|own car)/iu },
  { key: "car", value: "company", role: "employer", re: /((?:mashina|avto|avtomobil)\p{L}*\s+(?:beriladi|kompaniya\p{L}*|firma\p{L}*)|kompaniya\p{L}*\s+(?:mashina|avto|avtomobil)\p{L}*|служебн\p{L}*\s+(?:авто|автомобил|машин)\p{L}*|(?:авто|машин\p{L}*)\s+предоставля\p{L}*|company car)/iu },
  { key: "car", value: "yes", role: "worker", re: /((?:o'z|shaxsiy)\s+(?:mashina|avto|avtomobil)\p{L}*|(?:mashina|avtomobil|avto)(?:m|im)\s+bor|своя\s+(?:машина|авто)|есть\s+(?:машина|авто)\p{L}*|own car|have a car)/iu },
  { key: "car", value: "no", role: "worker", re: /((?:mashina|avtomobil|avto)(?:m|im)\s+yo'?q|нет\s+(?:машины|авто)\p{L}*|no car)/iu },
  { key: "transport", value: "foot", re: /(piyoda|пиёда|пеш\p{L}*|on foot)/iu },
  { key: "transport", value: "bike", re: /(velosiped|скутер|skuter|samokat|самокат|велосипед|bicycle|bike|scooter)/iu },
  { key: "transport", value: "moto", re: /(moto\p{L}*|мото\p{L}*)/iu },
  { key: "transport", value: "car", re: /(avtokuryer|avto\s*kuryer|автокурьер|(?:o'z\s+)?mashina\p{L}*\s+bilan|на\s+(?:авто|машин)\p{L}*)/iu },
  { key: "tools", value: "yes", role: "worker", re: /((?:o'z|shaxsiy)\s+asbob\p{L}*|asbob(?:-uskuna)?(?:larim|im)\s+bor|свой\s+инструмент\p{L}*|есть\s+инструмент\p{L}*|own tools)/iu },
  { key: "format", value: "hybrid", re: /(gibrid|aralash\s+format|гибрид\p{L}*|hybrid)/iu },
  { key: "format", value: "office", re: /(ofisda|ofis\s+ish|офисда|в\s+офисе|office)/iu },
  { key: "term", value: "once", re: /(bir\s*martalik|bir\s+kunlik\s+ish|бир\s*марталик|разов\p{L}*|одноразов\p{L}*|one-?time)/iu },
  { key: "term", value: "permanent", re: /(doimiy|доимий|постоянн\p{L}*|permanent)/iu },
  { key: "pay", value: "piece", re: /(dona\s*bay|donabay|ishbay|ish\s*bay|дона\s*бай|ишбай|сдельн\p{L}*|поштучн\p{L}*|piece-?rate)/iu },
  { key: "level", value: "junior", re: /(junior|джун\p{L}*|джуниор)/iu },
  { key: "level", value: "middle", re: /(middle|мидл\p{L}*)/iu },
  { key: "level", value: "senior", re: /(senior|сеньор\p{L}*|синьор\p{L}*)/iu },
  { key: "sales_place", value: "market", re: /(bozor|бозор|рынок|рынке)/iu },
  { key: "sales_place", value: "wholesale", re: /(optom|ulgurji|улгуржи|оптов\p{L}*|опт(?=$|[^\p{L}]))/iu },
  { key: "sales_place", value: "online", re: /(onlayn\s+savdo|telefon\s+orqali|онлайн[-\s]продаж\p{L}*|по\s+телефону)/iu },
  { key: "sales_place", value: "store", re: /(do'kon|дўкон|magazin|магазин|savdo\s+markaz\p{L}*|супермаркет|supermarket)/iu },
  { key: "pay_mode", value: "fixed_percent", re: /(oylik\s*(?:\+|va)\s*foiz|oklad\s*\+|оклад\s*(?:\+|и|плюс)\s*процент)/iu },
  { key: "pay_mode", value: "percent", re: /(foiz\s+asosida|faqat\s+foiz|foizga|только\s+процент|процент\s+от\s+продаж)/iu },
  { key: "fin_soft", value: "1c", role: "employer", re: /(1c|1с)(?=$|[^\p{L}\d])/iu },
  { key: "fin_soft", value: "excel", role: "employer", re: /(excel|эксел\p{L}*|эксель)/iu },
  { key: "vehicles", value: "truck", re: /(yuk\s+mashina\p{L}*|gruzovoy|грузов\p{L}*|truck)/iu },
  { key: "vehicles", value: "light", re: /(yengil\s+(?:mashina|avto)\p{L}*|легков\p{L}*)/iu },
  { key: "venue", value: "cafe", re: /(kafe|кафе|cafe)/iu },
  { key: "venue", value: "restaurant", re: /(restoran|ресторан|restaurant)/iu },
  { key: "venue", value: "canteen", re: /(stolovaya|столов\p{L}*|canteen)/iu },
  { key: "venue", value: "fastfood", re: /(fast\s*-?food|fastfud|фастфуд|фаст-фуд)/iu },
  { key: "venue", value: "banquet", re: /(to'yxona|тўйхона|банкет\p{L}*|banquet)/iu },
  ...req("medbook", /(sanitar\p{L}*\s+(?:daftar|kitob)\p{L}*|tibbiy\s+kitobcha|med\.?\s*kitob\p{L}*|санкниж\p{L}*|медкниж\p{L}*|санитарн\p{L}*\s+книж\p{L}*)/iu),
  { key: "languages", value: "plus_en", re: /(ingliz|инглиз|english|английск\p{L}*)/iu },
  { key: "languages", value: "uz_ru", re: /(rus\s+til\p{L}*|рус\s+тил\p{L}*|русск\p{L}*\s+язык\p{L}*|по-русски)/iu },
  { key: "teach_place", value: "kindergarten", re: /(bog'cha|боғча|детск\p{L}*\s+сад\p{L}*|kindergarten)/iu },
  { key: "teach_place", value: "school", re: /(maktab|мактаб|школ\p{L}*|school)/iu },
  { key: "teach_place", value: "center", re: /(o'quv\s+markaz\p{L}*|ўқув\s+марказ\p{L}*|учебн\p{L}*\s+центр\p{L}*)/iu },
  { key: "teach_place", value: "private", re: /(repetitor|репетитор\p{L}*)/iu },
  ...req("cert", /(ielts|cefr|toefl|sertifikat\p{L}*|сертификат\p{L}*)/iu),
  { key: "med_place", value: "pharmacy", re: /(dorixona|дорихона|аптек\p{L}*|pharmacy)/iu },
  { key: "med_place", value: "private", re: /(xususiy\s+klinika\p{L}*|хусусий\s+клиника\p{L}*|частн\p{L}*\s+клиник\p{L}*|private clinic)/iu },
  { key: "edu", value: "higher", re: /(oliy\s+ma'lumot\p{L}*|олий\s+маълумот\p{L}*|высш\p{L}*\s+образован\p{L}*|higher education)/iu },
  { key: "edu", value: "secondary", re: /(o'rta\s+maxsus|ўрта\s+махсус|среднее\s+специальн\p{L}*)/iu },
  { key: "med_edu", value: "higher", role: "worker", re: /(oliy\s+ma'lumot\p{L}*|олий\s+маълумот\p{L}*|высш\p{L}*\s+образован\p{L}*)/iu },
  { key: "med_edu", value: "secondary", role: "worker", re: /(o'rta\s+maxsus|kollej|texnikum|ўрта\s+махсус|колледж|техникум)/iu },
  { key: "med_edu", value: "student", role: "worker", re: /(talaba|student|студент\p{L}*)/iu },
  { key: "clean_place", value: "office", re: /(ofis|офис|office)/iu },
  { key: "clean_place", value: "hotel", re: /(mehmonxona|меҳмонхона|гостиниц\p{L}*|отел\p{L}*|hotel)/iu },
  { key: "clean_place", value: "home", re: /(xonadon|хонадон|uy\s+tozala\p{L}*|квартир\p{L}*)/iu },
  { key: "clean_place", value: "mall", re: /(do'kon|savdo\s+markaz\p{L}*|магазин\p{L}*|тц(?=$|[^\p{L}]))/iu },
  { key: "guard_shift", value: "day24", re: /(sutkalik|сутка\p{L}*|сутки|суточн\p{L}*)/iu },
  { key: "guard_shift", value: "night", re: /(tungi\s+(?:qorovul|navbat|smena)\p{L}*|ночн\p{L}*)/iu },
  ...req("army", /(armiya|harbiy\s+xizmat\p{L}*|армия|армию|армии|отслуж\p{L}*)/iu),
  { key: "machine", value: "overlock", re: /(overlok|оверлок\p{L}*|overlock)/iu },
  { key: "night", value: "yes", re: /(tungi\s+smena\p{L}*|тунги\s+смена\p{L}*|ночн\p{L}*\s+смен\p{L}*|night shift)/iu },
  { key: "season", value: "seasonal", re: /(mavsumiy|мавсумий|sezon\p{L}*|сезонн\p{L}*|seasonal)/iu },
  { key: "farm_place", value: "greenhouse", re: /(issiqxona|иссиқхона|теплиц\p{L}*|greenhouse)/iu },
  { key: "farm_place", value: "livestock", re: /(ferma|chorva|ферма|ферме|чорва|livestock)/iu },
  { key: "farm_place", value: "field", re: /(dala|дала|в\s+поле|field)/iu },
  { key: "farm_place", value: "garden", re: /(bog'(?!cha)|боғ(?!ча)|в\s+саду|orchard)/iu },
  ...req("lawyer_license", /(advokat\p{L}*\s+litsenziya\p{L}*|litsenziya\p{L}*\s+advokat|адвокатск\p{L}*\s+лиценз\p{L}*|адвокатск\p{L}*\s+статус\p{L}*)/iu),
  { key: "degree", value: "phd", re: /(phd|dsc|fan\s+nomzodi|fan\s+doktori|кандидат\s+наук|доктор\s+наук)/iu },
  { key: "degree", value: "master", re: /(magistr|магистр\p{L}*|master's)/iu },
  { key: "cad", value: "autocad", re: /(autocad|автокад)/iu },
  { key: "cad", value: "revit", re: /(revit|ревит)/iu },
  { key: "cad", value: "solidworks", re: /(solidworks|солидворкс)/iu },
  { key: "heights", value: "yes", re: /(balandlik\p{L}*|баландлик\p{L}*|на\s+высоте|высотн\p{L}*)/iu },
  { key: "vaxta", value: "yes", re: /(vaxta|вахта|вахт\p{L}*)/iu },
  { key: "portfolio", value: "yes", role: "worker", re: /(portfolio|портфолио)/iu },
  { key: "cashier", value: "yes", role: "worker", re: /(kassa\p{L}*|касс\p{L}*)/iu },
  { key: "own_clients", value: "yes", role: "worker", re: /(o'z\s+mijoz\p{L}*|mijozlarim\s+bor|свои\s+клиент\p{L}*|своя\s+клиентск\p{L}*)/iu },
  { key: "workshop", value: "yes", role: "worker", re: /(ustaxona\p{L}*\s+bor|o'z\s+ustaxona\p{L}*|своя\s+мастерск\p{L}*)/iu },
];

/** Elektr xavfsizligi guruhi: "III guruh", "3 guruh", "группа IV" */
const EL_GROUP = /(?:(ii|iii|iv|v|2|3|4|5)\s*(?:-?\s*)?(?:guruh\p{L}*|группа|группы|gr\.?)|(?:группа|guruh)\s*(ii|iii|iv|v|2|3|4|5))(?=$|[^\p{L}\d])/iu;
const ROMAN: Record<string, string> = { ii: "g2", "2": "g2", iii: "g3", "3": "g3", iv: "g4", "4": "g4", v: "g5", "5": "g5" };
const CYR: Record<string, string> = { в: "b", с: "c", д: "d", е: "e" };

function pick(text: string, keys: readonly string[], role: "employer" | "worker", options: Record<string, readonly string[]>): Record<string, string> {
  const s = lower(text);
  const out: Record<string, string> = {};
  for (const w of WORDS) {
    if (!keys.includes(w.key) || out[w.key] || (w.role && w.role !== role)) continue;
    const m = w.re.exec(s);
    if (!m) continue;
    // kirill harflari ("С тоифа") — lotinchaga
    const value = w.value === "$" ? (m[1] ?? "").replace(/[всде]/g, (c) => CYR[c]!).toUpperCase() : w.value;
    if (options[w.key]?.includes(value)) out[w.key] = value;
  }
  if (keys.includes("el_group") && !out.el_group) {
    const m = EL_GROUP.exec(s);
    const g = m ? ROMAN[(m[1] ?? m[2] ?? "").toLowerCase()] : undefined;
    if (g) out.el_group = g;
  }
  // "1C va Excel" (ishchi) — ikkalasi
  if (role === "worker" && keys.includes("fin_soft") && !out.fin_soft) {
    const c1 = /(1c|1с)(?=$|[^\p{L}\d])/iu.test(s);
    const ex = /(excel|эксел|эксель)/iu.test(s);
    if (c1 || ex) out.fin_soft = c1 && ex ? "both" : c1 ? "1c" : "excel";
  }
  return out;
}

/** Matndan faqat shu kasbga tegishli qo'shimcha javoblar (masalan, kuryer bo'lmasa — "piyoda" olinmaydi) */
export function pickExtras(text: string, keys: readonly ExtraKey[]): Extras {
  return pick(text, keys, "employer", EXTRA_OPTIONS) as Extras;
}

// ------------------------------------------------------------------------------------------------ ko'rsatish

/** Yosh chegarasi matni ("18–35 yosh", "25 yoshdan", "40 yoshgacha"); "farqi yo'q" — null */
export function ageLabel(a: AgeRange, t: (k: string, v?: Record<string, string | number>) => string): string | null {
  if (a.min !== null && a.max !== null) return t("easy.vguide.age_range", { min: a.min, max: a.max });
  if (a.min !== null) return t("easy.vguide.age_from", { min: a.min });
  if (a.max !== null) return t("easy.vguide.age_to", { max: a.max });
  return null;
}

/** "09:00–18:00" */
export function hoursLabel(h: WorkHours): string {
  return `${h.from}–${h.to}`;
}

/** Qo'shimcha javoblar → e'lon matnidagi ✅ bandlar (farqi yo'q va masofaviy — yozilmaydi: masofaviylik joy qatorida) */
export function extraLines(extras: Extras | undefined, keys: readonly ExtraKey[], t: (k: string, v?: Record<string, string | number>) => string): string[] {
  if (!extras) return [];
  return keys.flatMap((k) => {
    const v = extras[k];
    if (!v || SILENT.has(v) || (k === "format" && v === "remote")) return [];
    return [t(k === "license" ? "easy.vguide.x.license.line" : `easy.vguide.x.${k}.line_${v}`, { value: v })];
  });
}

// ------------------------------------------------------------------------------------------------ ishchi e'loni

/**
 * Ishchi e'loni (chatda): kasbdan keyin — shu kasbga xos 1–2 savol (ega, 2026-11-24: "ishchiga ham", keyin "hamma
 * kasblardan"). Javoblar e'lon matniga ✅ bilan qo'shiladi ("yo'q", "farqi yo'q" — yozilmaydi).
 */
const WOPTS = {
  license: ["B", "BC", "C", "CE", "D", "E"],
  car: ["yes", "no"],
  transport: ["foot", "bike", "moto", "car"],
  tools: ["yes", "no"],
  level: ["junior", "middle", "senior"],
  portfolio: ["yes", "no"],
  sales_place: ["store", "market", "wholesale", "online", "any"],
  cashier: ["yes", "no"],
  fin_soft: ["1c", "excel", "both", "none"],
  machine: ["straight", "overlock", "both"],
  el_group: ["g2", "g3", "g4", "g5", "none"],
  night: ["yes", "no"],
  vehicles: ["light", "truck", "both"],
  venue: ["cafe", "restaurant", "canteen", "fastfood", "banquet", "any"],
  medbook: ["yes", "no"],
  languages: ["uz", "ru", "uz_ru", "plus_en"],
  teach_place: ["school", "center", "kindergarten", "online", "private", "any"],
  cert: ["yes", "no"],
  med_edu: ["higher", "secondary", "student"],
  clean_place: ["office", "home", "mall", "hotel", "any"],
  army: ["yes", "no"],
  guard_shift: ["day", "night", "day24", "any"],
  own_clients: ["yes", "no"],
  season: ["seasonal", "permanent", "any"],
  lawyer_license: ["yes", "no"],
  degree: ["phd", "master", "none"],
  team: ["small", "medium", "large", "none"],
  edu: ["higher", "secondary"],
  cad: ["autocad", "revit", "solidworks", "none"],
  heights: ["yes", "no"],
  vaxta: ["yes", "no"],
  workshop: ["yes", "no"],
} as const;
export type WorkerExtraKey = keyof typeof WOPTS;
export const WORKER_EXTRA_OPTIONS: Record<WorkerExtraKey, readonly string[]> = WOPTS;
export const WORKER_EXTRA_KEYS = Object.keys(WOPTS) as WorkerExtraKey[];
export type WorkerExtras = Partial<Record<WorkerExtraKey, string>>;

const USTA_TOOLS = new Set(["construction", "craftsman", "plumber"]);
const WORKER_BY_CATEGORY: Partial<Record<string, WorkerExtraKey[]>> = {
  it: ["level"],
  design: ["portfolio"],
  marketing: ["portfolio"],
  culture: ["portfolio"],
  sales: ["sales_place", "cashier"],
  finance: ["fin_soft"],
  sewing: ["machine"],
  mechanic: ["night"],
  production: ["night"],
  logistics: ["night"],
  auto_service: ["vehicles", "tools"],
  restaurant: ["venue", "medbook"],
  call_center: ["languages"],
  office: ["languages"],
  hotel: ["languages"],
  education: ["teach_place", "cert"],
  medicine: ["med_edu"],
  cleaning: ["clean_place"],
  security: ["army", "guard_shift"],
  beauty: ["own_clients", "tools"],
  agriculture: ["season"],
  legal: ["lawyer_license"],
  science: ["degree"],
  management: ["team"],
  government: ["edu"],
  engineering: ["cad"],
  telecom: ["heights"],
  energy: ["el_group"],
  mining: ["vaxta"],
  real_estate: ["car"],
  crafts: ["workshop"],
};

export function workerExtraKeysFor(p: ProfessionContext): WorkerExtraKey[] {
  const name = p.names.join(" ");
  switch (p.category) {
    case "driver":
      return DRIVER_NAME.test(name) ? driverKeys(name) : [];
    case "courier":
      return COURIER_NAME.test(name) && !NOT_COURIER.test(name) ? ["transport"] : [];
    case "electrician":
      return NOT_TOOLS.test(name) ? ["el_group"] : ["tools", "el_group"];
    default:
      if (p.category && USTA_TOOLS.has(p.category)) return NOT_TOOLS.test(name) ? [] : ["tools"];
      return (p.category && WORKER_BY_CATEGORY[p.category]) || [];
  }
}

const YES = /^(ha|xa|bor|albatta|ҳа|ха|бор|албатта|да|есть|yes|yep)(?=$|[^\p{L}])/iu;
const NO = /^(yo'q|yoq|йўқ|йук|нет|no|nope)(?=$|[^\p{L}'])/iu;

/** Ishchi yozganidan ("C toifa haydovchiman, mashinam bor") — shu kasb savollariga javoblar */
export function pickWorkerExtras(text: string, keys: readonly WorkerExtraKey[]): WorkerExtras {
  return pick(text, keys, "worker", WORKER_EXTRA_OPTIONS) as WorkerExtras;
}

const norm = (s: string) => lower(s).replace(/[^\p{L}\p{N}']+/gu, " ").replace(/\s+/g, " ").trim();

/**
 * Bitta savolga yozib javob berildi ("C", "ha", "velosipedda", "maktabda") — tushunilmasa null. `labels` — tugmalardagi
 * matnlar (joriy tilda): yozilgani ulardan biriga mos kelsa — o'sha.
 */
export function parseWorkerExtra(key: WorkerExtraKey, text: string, labels: Record<string, string> = {}): string | null {
  const s = lower(text).trim();
  const options = WORKER_EXTRA_OPTIONS[key];
  if (key === "license") {
    const bare = /^([bcdeвсде]{1,2})(?:\s|$|\s*toifa|\s*тоифа)/iu.exec(s);
    const v = bare ? bare[1]!.replace(/[всде]/g, (c) => CYR[c]!).toUpperCase() : pickWorkerExtras(text, [key]).license;
    return v && options.includes(v) ? v : null;
  }
  const hit = pickWorkerExtras(text, [key])[key];
  if (hit) return hit;
  if (options.includes("yes") && options.includes("no")) {
    if (YES.test(s)) return "yes";
    if (NO.test(s)) return "no";
  }
  // tugma matniga mos ("Maktab", "o'quv markazida" → "O'quv markazi")
  const t = norm(text);
  if (t.length < 2) return null;
  const found = options.filter((o) => {
    const l = labels[o] ? norm(labels[o]!) : "";
    return !!l && (l === t || t.includes(l) || (t.length >= 3 && l.startsWith(t)) || (l.length >= 4 && t.startsWith(l.slice(0, Math.max(4, l.length - 3)))));
  });
  return found.length === 1 ? found[0]! : null;
}

export function isWorkerExtras(x: unknown): x is WorkerExtras {
  if (x === undefined) return true;
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  return Object.entries(x as Record<string, unknown>).every(([k, v]) => (WORKER_EXTRA_KEYS as readonly string[]).includes(k) && typeof v === "string" && WORKER_EXTRA_OPTIONS[k as WorkerExtraKey].includes(v));
}

/** Ishchi javoblari → e'lon matnidagi ✅ bandlar ("yo'q", "farqi yo'q" javoblari yozilmaydi) */
export function workerExtraLines(extras: WorkerExtras | undefined, keys: readonly WorkerExtraKey[], t: (k: string, v?: Record<string, string | number>) => string): string[] {
  if (!extras) return [];
  return keys.flatMap((k) => {
    const v = extras[k];
    if (!v || SILENT.has(v)) return [];
    return [t(k === "license" ? "easy.guided.wx.license.line" : `easy.guided.wx.${k}.line_${v}`, { value: v })];
  });
}

/** "HH:MM" tekshiruvi (forma va server uchun) */
export const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
