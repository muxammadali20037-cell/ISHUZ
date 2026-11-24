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

export type ExtraKey = "license" | "car" | "transport" | "format" | "term" | "pay";
export const EXTRA_KEYS: readonly ExtraKey[] = ["license", "car", "transport", "format", "term", "pay"];
/** Variantlar (matni — easy.vguide.x.<kalit>.<variant>; "any" — farqi yo'q, e'longa yozilmaydi) */
export const EXTRA_OPTIONS: Record<ExtraKey, readonly string[]> = {
  license: ["B", "BC", "C", "CE", "D", "E"],
  car: ["company", "own"],
  transport: ["foot", "bike", "moto", "car", "any"],
  format: ["office", "remote", "hybrid"],
  term: ["permanent", "once"],
  pay: ["piece", "monthly"],
};
export type Extras = Partial<Record<ExtraKey, string>>;

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

const USTA_CATEGORIES = new Set(["construction", "craftsman", "electrician", "plumber"]);
const DRIVER_NAME = /(haydovchi|haydovchisi|shofyor|shofer|taksi|ҳайдовчи|хайдовчи|такси|водител|шофер|шофёр|таксист|driver)/iu;
const COURIER_NAME = /(kuryer|kurer|yetkazib|етказиб|курьер|доставщик|доставк|courier|delivery)/iu;
const NOT_REMOTE_DESIGN = /(fotograf|фотограф|videograf|видеограф|operator|оператор)/iu;
/** kuryerlik xizmatining ofis xodimlari — transport so'ralmaydi */
const NOT_COURIER = /(dispetcher|supervayzer|operator|menejer|punkt|диспетчер|супервайзер|оператор|менеджер|пункт)/iu;
/** maxsus texnika (avtobus, samosval, traktor…) — mashina kimnikiligi so'ralmaydi (har doim ish beruvchiniki) */
const SPECIAL_VEHICLE = /(avtobus|samosval|traktor|kombayn|forklift|pogruzchik|evakuator|refrijerator|beton|mikser|tez yordam|assenizator|chiqindi|pochta|inkassator|автобус|самосвал|трактор|комбайн|погрузчик|эвакуатор|рефрижератор|бетон|миксер|скорой|ассенизатор|мусор|почтов|инкассатор)/iu;
/** traktor, kombayn, yuklagich — boshqa turdagi guvohnoma (B–E toifa emas) */
const OTHER_LICENSE = /(traktor|kombayn|forklift|pogruzchik|трактор|комбайн|погрузчик)/iu;
/** usta sohasidagi boshqaruv va texnika xodimlari — "o'z asboblari" so'ralmaydi */
const NOT_TOOLS = /(operator|prorab|muhandis|smeta|dispetcher|menejer|оператор|прораб|инженер|смет|диспетчер|менеджер)/iu;

function driverKeys<K extends "license" | "car">(name: string): K[] {
  const out: ("license" | "car")[] = [];
  if (!OTHER_LICENSE.test(name)) out.push("license");
  if (!SPECIAL_VEHICLE.test(name)) out.push("car");
  return out as K[];
}

/** Shu kasb uchun qo'shimcha savollar (tartibi bilan) */
export function extraKeysFor(p: ProfessionContext): ExtraKey[] {
  const name = p.names.join(" ");
  if (p.category === "driver" && DRIVER_NAME.test(name)) return driverKeys(name);
  if (p.category === "courier" && COURIER_NAME.test(name) && !NOT_COURIER.test(name)) return ["transport"];
  if (p.category === "sewing") return ["pay"];
  if (p.category && USTA_CATEGORIES.has(p.category)) return ["term"];
  if ((p.category === "it" || p.category === "design") && !NOT_REMOTE_DESIGN.test(name)) return ["format"];
  return [];
}

/** Kasb nomining o'zidan tushuniladigan javoblar ("C toifa haydovchi" → C; "Piyoda kuryer" → piyoda) */
export function extrasFromName(p: ProfessionContext): Extras {
  const keys = extraKeysFor(p);
  return pickExtras(p.names.join(" "), keys);
}

/** Ish vaqti so'raladimi: masofaviy, bir martalik va smenali/erkin grafikda — yo'q */
export function hoursRelevant(d: { remote: boolean; extras?: Extras; schedule: string }): boolean {
  if (d.remote) return false;
  if (d.extras?.term === "once") return false;
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

const EXTRA_WORDS: { key: ExtraKey; value: string; re: RegExp }[] = [
  // guvohnoma toifasi: "C toifa", "BC toifali", "категория CE", "права D"
  { key: "license", value: "$", re: /(?:^|[^\p{L}])([bcdeвсде]{1,2})\s*(?:toifa\p{L}*|тоифа\p{L}*|kategoriya\p{L}*|категори\p{L}*|prava|права)/iu },
  { key: "license", value: "$", re: /(?:toifa\p{L}*|тоифа\p{L}*|kategoriya\p{L}*|категори\p{L}*|prava|права)\s*[:-]?\s*["«]?([bcdeвсде]{1,2})(?=$|[^\p{L}])/iu },
  { key: "car", value: "own", re: /(o'z\s+(?:mashina|avto|avtomobil)\p{L}*|shaxsiy\s+(?:mashina|avto|avtomobil)\p{L}*|своим\s+(?:авто|автомобил|машин)\p{L}*|личн\p{L}*\s+(?:авто|автомобил|машин)\p{L}*|own car)/iu },
  { key: "car", value: "company", re: /((?:mashina|avto|avtomobil)\p{L}*\s+(?:beriladi|kompaniya\p{L}*|firma\p{L}*)|kompaniya\p{L}*\s+(?:mashina|avto|avtomobil)\p{L}*|служебн\p{L}*\s+(?:авто|автомобил|машин)\p{L}*|(?:авто|машин\p{L}*)\s+предоставля\p{L}*|company car)/iu },
  { key: "transport", value: "foot", re: /(piyoda|пиёда|пеш\p{L}*|on foot)/iu },
  { key: "transport", value: "bike", re: /(velosiped|скутер|skuter|samokat|самокат|велосипед|bicycle|bike|scooter)/iu },
  { key: "transport", value: "moto", re: /(moto\p{L}*|мото\p{L}*)/iu },
  { key: "transport", value: "car", re: /(avtokuryer|avto\s*kuryer|автокурьер|(?:o'z\s+)?mashina\p{L}*\s+bilan|на\s+(?:авто|машин)\p{L}*)/iu },
  { key: "format", value: "hybrid", re: /(gibrid|aralash\s+format|гибрид\p{L}*|hybrid)/iu },
  { key: "format", value: "office", re: /(ofisda|ofis\s+ish|офисда|в\s+офисе|office)/iu },
  { key: "term", value: "once", re: /(bir\s*martalik|bir\s+kunlik\s+ish|бир\s*марталик|разов\p{L}*|одноразов\p{L}*|one-?time)/iu },
  { key: "term", value: "permanent", re: /(doimiy|доимий|постоянн\p{L}*|permanent)/iu },
  { key: "pay", value: "piece", re: /(dona\s*bay|donabay|ishbay|ish\s*bay|дона\s*бай|ишбай|сдельн\p{L}*|поштучн\p{L}*|piece-?rate)/iu },
];

const CYR: Record<string, string> = { в: "b", с: "c", д: "d", е: "e" };

/** Matndan faqat shu kasbga tegishli qo'shimcha javoblar (masalan, kuryer bo'lmasa — "piyoda" olinmaydi) */
export function pickExtras(text: string, keys: readonly ExtraKey[]): Extras {
  const s = lower(text);
  const out: Extras = {};
  for (const w of EXTRA_WORDS) {
    if (!keys.includes(w.key) || out[w.key]) continue;
    const m = w.re.exec(s);
    if (!m) continue;
    // kirill harflari ("С тоифа") — lotinchaga
    const value = w.value === "$" ? (m[1] ?? "").replace(/[всде]/g, (c) => CYR[c]!).toUpperCase() : w.value;
    if (EXTRA_OPTIONS[w.key].includes(value)) out[w.key] = value;
  }
  return out;
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
    if (!v || v === "any" || (k === "format" && v === "remote")) return [];
    return [t(k === "license" ? "easy.vguide.x.license.line" : `easy.vguide.x.${k}.line_${v}`, { value: v })];
  });
}

// ------------------------------------------------------------------------------------------------ ishchi e'loni

/**
 * Ishchi e'loni (chatda): kasbdan keyin kasbga xos savol (ega, 2026-11-24: "ishchiga ham"): haydovchi — guvohnoma toifasi va
 * shaxsiy mashinasi; kuryer — nimada yetkazadi; usta — o'z asboblari. Javoblar e'lon matniga ✅ bilan qo'shiladi.
 */
export type WorkerExtraKey = "license" | "car" | "transport" | "tools";
export const WORKER_EXTRA_KEYS: readonly WorkerExtraKey[] = ["license", "car", "transport", "tools"];
export const WORKER_EXTRA_OPTIONS: Record<WorkerExtraKey, readonly string[]> = {
  license: ["B", "BC", "C", "CE", "D", "E"],
  car: ["yes", "no"],
  transport: ["foot", "bike", "moto", "car"],
  tools: ["yes", "no"],
};
export type WorkerExtras = Partial<Record<WorkerExtraKey, string>>;

export function workerExtraKeysFor(p: ProfessionContext): WorkerExtraKey[] {
  const name = p.names.join(" ");
  if (p.category === "driver" && DRIVER_NAME.test(name)) return driverKeys(name);
  if (p.category === "courier" && COURIER_NAME.test(name) && !NOT_COURIER.test(name)) return ["transport"];
  if (p.category && USTA_CATEGORIES.has(p.category) && !NOT_TOOLS.test(name)) return ["tools"];
  return [];
}

const YES = /^(ha|xa|bor|albatta|ҳа|ха|бор|албатта|да|есть|yes|yep)(?=$|[^\p{L}])/iu;
const NO = /^(yo'q|yoq|йўқ|йук|нет|no|nope)(?=$|[^\p{L}'])/iu;
const WORKER_WORDS: { key: WorkerExtraKey; value: string; re: RegExp }[] = [
  { key: "car", value: "yes", re: /((?:o'z|shaxsiy)\s+(?:mashina|avto|avtomobil)\p{L}*|(?:mashina|avtomobil|avto)(?:m|im)\s+bor|своя\s+(?:машина|авто)|есть\s+(?:машина|авто)\p{L}*|own car|have a car)/iu },
  { key: "car", value: "no", re: /((?:mashina|avtomobil|avto)(?:m|im)\s+yo'?q|нет\s+(?:машины|авто)\p{L}*|no car)/iu },
  { key: "tools", value: "yes", re: /((?:o'z|shaxsiy)\s+asbob\p{L}*|asbob(?:-uskuna)?(?:larim|im)\s+bor|свой\s+инструмент\p{L}*|есть\s+инструмент\p{L}*|own tools)/iu },
];

/** Ishchi yozganidan ("C toifa haydovchiman, mashinam bor") — shu kasb savollariga javoblar */
export function pickWorkerExtras(text: string, keys: readonly WorkerExtraKey[]): WorkerExtras {
  const out: WorkerExtras = {};
  const shared = pickExtras(text, keys.filter((k): k is "license" | "transport" => k === "license" || k === "transport"));
  if (shared.license) out.license = shared.license;
  if (shared.transport && shared.transport !== "any") out.transport = shared.transport;
  const s = lower(text);
  for (const w of WORKER_WORDS) if (keys.includes(w.key) && !out[w.key] && w.re.test(s)) out[w.key] = w.value;
  return out;
}

/** Bitta savolga yozib javob berildi ("C", "ha", "velosipedda") — tushunilmasa null */
export function parseWorkerExtra(key: WorkerExtraKey, text: string): string | null {
  const s = lower(text).trim();
  if (key === "car" || key === "tools") {
    const hit = pickWorkerExtras(text, [key])[key];
    if (hit) return hit;
    return YES.test(s) ? "yes" : NO.test(s) ? "no" : null;
  }
  if (key === "license") {
    const bare = /^([bcdeвсде]{1,2})(?:\s|$|\s*toifa|\s*тоифа)/iu.exec(s);
    const v = bare ? bare[1]!.replace(/[всде]/g, (c) => CYR[c]!).toUpperCase() : pickWorkerExtras(text, [key]).license;
    return v && WORKER_EXTRA_OPTIONS.license.includes(v) ? v : null;
  }
  return pickWorkerExtras(text, [key])[key] ?? null;
}

export function isWorkerExtras(x: unknown): x is WorkerExtras {
  if (x === undefined) return true;
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  return Object.entries(x as Record<string, unknown>).every(([k, v]) => (WORKER_EXTRA_KEYS as readonly string[]).includes(k) && typeof v === "string" && WORKER_EXTRA_OPTIONS[k as WorkerExtraKey].includes(v));
}

/** Ishchi javoblari → e'lon matnidagi ✅ bandlar ("yo'q" javoblari yozilmaydi) */
export function workerExtraLines(extras: WorkerExtras | undefined, keys: readonly WorkerExtraKey[], t: (k: string, v?: Record<string, string | number>) => string): string[] {
  if (!extras) return [];
  return keys.flatMap((k) => {
    const v = extras[k];
    if (!v || v === "no") return [];
    return [t(k === "license" ? "easy.guided.wx.license.line" : `easy.guided.wx.${k}.line_${v}`, { value: v })];
  });
}

/** "HH:MM" tekshiruvi (forma va server uchun) */
export const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
