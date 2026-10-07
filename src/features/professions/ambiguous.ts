/**
 * Noaniq so'zlar: "usta", "o'qituvchi", "operator"... Foydalanuvchi shunchaki shuni yozsa, ilova bitta kasbga majburlamaydi —
 * avval "Qaysi usta?" deb yo'nalishni so'raydi, keyin tegishli kasblar ochiladi.
 * Variant: `sector` — soha daraxtini ochadi; `query` — aniqroq qidiruv (natijasi bazada mavjud).
 */
export interface AmbiguousOption {
  key: string;
  sector?: string;
  query?: string;
}

export interface AmbiguousTerm {
  key: string;
  options: AmbiguousOption[];
}

const TERMS: { words: string[]; term: AmbiguousTerm }[] = [
  {
    words: ["usta", "ustа", "уста", "master", "мастер", "ustalar"],
    term: {
      key: "usta",
      options: [
        { key: "auto", sector: "auto_service" },
        { key: "construction", sector: "construction" },
        { key: "electric", sector: "electrician" },
        { key: "plumbing", sector: "plumber" },
        { key: "repair", sector: "craftsman" },
        { key: "beauty", sector: "beauty" },
        { key: "sewing", sector: "sewing" },
        { key: "crafts", sector: "crafts" },
      ],
    },
  },
  {
    words: ["oqituvchi", "o'qituvchi", "oqtuvchi", "ustoz", "muallim", "ўқитувчи", "учитель", "преподаватель", "pedagog", "педагог"],
    term: {
      key: "teacher",
      options: [
        { key: "school", sector: "education" },
        { key: "driving", query: "avtoinstruktor" },
        { key: "sport", query: "murabbiy" },
        { key: "kindergarten", query: "tarbiyachi" },
      ],
    },
  },
  {
    words: ["operator", "оператор"],
    term: {
      key: "operator",
      options: [
        { key: "call", sector: "call_center" },
        { key: "machine", query: "ekskavator" },
        { key: "cnc", query: "cnc" },
        { key: "production", sector: "production" },
      ],
    },
  },
  {
    words: ["menejer", "menedjer", "manager", "менеджер"],
    term: {
      key: "manager",
      options: [
        { key: "sales", sector: "sales" },
        { key: "marketing", sector: "marketing" },
        { key: "office", sector: "office" },
        { key: "management", sector: "management" },
      ],
    },
  },
  {
    words: ["ishchi", "ишчи", "rabochiy", "рабочий", "rabochi"],
    term: {
      key: "worker",
      options: [
        { key: "production", sector: "production" },
        { key: "construction", sector: "construction" },
        { key: "warehouse", sector: "logistics" },
        { key: "agriculture", sector: "agriculture" },
        { key: "cleaning", sector: "cleaning" },
      ],
    },
  },
  {
    words: ["muhandis", "injener", "инженер", "engineer"],
    term: {
      key: "engineer",
      options: [
        { key: "engineering", sector: "engineering" },
        { key: "construction", sector: "construction" },
        { key: "energy", sector: "energy" },
        { key: "it", sector: "it" },
      ],
    },
  },
];

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ʻʼ'‘’`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const INDEX = new Map<string, AmbiguousTerm>();
for (const { words, term } of TERMS) for (const w of words) INDEX.set(norm(w), term);

/** Yozilgan so'z noaniq bo'lsa — aniqlashtirish variantlari, aks holda null */
export function ambiguousTerm(query: string): AmbiguousTerm | null {
  const q = norm(query);
  return INDEX.get(q) ?? INDEX.get(q.replace(/'/g, "")) ?? null;
}
