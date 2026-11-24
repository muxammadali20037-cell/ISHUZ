import { normalizeText } from "@/features/search/understand";

/**
 * "Menejer" oilasi (ega, 2026-11-24: "meneger degan kasb bormi"). Bazada bitta "Menejer" kasbi yo'q — 77 ta aniq menejer bor
 * (savdo, ofis, HR, SMM, restoran…). Faqat "menejer kerak" deb yozilsa, ulardan birini taxmin qilib qo'yish noto'g'ri
 * (avval "Tadbir tashkilotchisi (event menejer)" tanlanib qolardi), "meneger" esa umuman tushunilmasdi. Endi:
 * - imlo shakllari ("meneger", "menedjer", "менеджер", "manager") — bitta so'z;
 * - qaysi menejerligi aytilgan bo'lsa ("savdo menejeri", "restoranga menejer") — o'sha kasb;
 * - aytilmagan bo'lsa — "Qanday menejer kerak?": avval ko'p so'raladiganlari, "Hammasi" — qolganlari.
 * Kasblar faqat bazadagi ma'lumotnomadan (bu yerda ro'yxat yo'q, faqat tartib).
 */

/** menejer, meneger, menedjer (ruscha "менеджер" lotinda), menedzher, menajer, manejer, manager + qo'shimchalari */
const WORD = /^(?:men[aei](?:dzh|dj|dz|dg|j|g)|man[ae](?:dzh|dj|j|g))er/;
const CORRECT = /^(?:menejer|manager)/;

export function isManagerWord(word: string): boolean {
  return WORD.test(word);
}

/** "meneger" → "menejer", "menedjerman" → "menejerman" (so'z normalizeText'dan o'tgan); boshqa so'z — o'zgarmaydi */
export function fixManagerTypo(word: string): string {
  return WORD.test(word) && !CORRECT.test(word) ? word.replace(WORD, "menejer") : word;
}

/** Qidiruv matnidagi lotin so'zlarida imlo shakli tuzatiladi ("Meneger kerak" → "menejer kerak"); boshqasi o'zgarmaydi */
export function fixManagerTypos(text: string): string {
  return text.replace(/[a-z]+/gi, (w) => {
    const n = w.toLowerCase();
    return WORD.test(n) && !CORRECT.test(n) ? fixManagerTypo(n) : w;
  });
}

export function mentionsManager(text: string): boolean {
  return normalizeText(text).split(" ").some(isManagerWord);
}

/** Bo'lak faqat "menejer" so'zidan iborat ("menejer", "менеджер", "menejerman") — undan topilgan kasb taxmin, aniq emas */
export function onlyManagerWords(fragment: string): boolean {
  const ws = normalizeText(fragment).split(" ").filter(Boolean);
  return ws.length > 0 && ws.every(isManagerWord);
}

/** Ko'p so'raladiganlari — shu tartibda birinchi (slug: kasblar daraxtidagi doimiy kalit) */
export const POPULAR_MANAGERS = [
  "sales-sales-manager",
  "office-office-manager",
  "office-hr-manager",
  "office-project-manager",
  "marketing-smm-manager",
  "restaurant-restaurant-manager",
  "sales-marketplace-manager",
  "sales-account-manager",
  "marketing-content-manager",
  "hotel-hotel-manager",
  "logistics-procurement-manager",
  "management-operations-manager",
] as const;

/** Variantlar ro'yxatida birinchi ko'rinadiganlar soni (qolgani — "Hammasi" tugmasi ortida) */
export const MANAGER_FIRST = 12;

export interface ManagerNode {
  id: string;
  slug: string;
  name_uz: string;
  name_ru: string;
  name_en: string | null;
  aliases: string[] | null;
}

/** Nomdagi bog'lovchi va umumiy so'zlar — "qaysi menejer" ekanini bildirmaydi */
const FILLER = new Set(["va", "bilan", "ishlash", "boyicha", "bo'yicha", "po", "s", "i", "v", "na", "dlya", "rabote", "and", "of", "for", "the"]);

const bare = (s: string) => s.replace(/['‘’ʻʼ`´]/g, "");

function words(s: string): string[] {
  return normalizeText(s)
    .replace(/[-/.$+]/g, " ")
    .split(" ")
    .map(bare)
    .filter((w) => w && !FILLER.has(w) && !isManagerWord(w));
}

/** Aytilgan so'z nomdagi so'zga mos: qisqa so'z (HR, SMM, PR) — aynan; uzunroq — o'zagi bilan ("restoranga" ~ "restoran") */
function fits(said: string, name: string): boolean {
  if (said.length < 4 || name.length < 4) return said === name;
  return name.startsWith(said) || said.startsWith(name);
}

export interface ManagerChoice<T extends ManagerNode> {
  /** aniq aytilgan bitta menejer ("savdo menejeri", "restoranga menejer") */
  pick: T | null;
  /** variantlar: avval aytilgan so'zga mos kelganlari, keyin ko'p so'raladiganlari, keyin qolgani (alifbo tartibida) */
  ordered: T[];
}

/**
 * `said` — gapdagi kasb so'zlari (hudud va maqsad so'zlarisiz, qo'shimchasiz shakllari bilan). Nomi (yoki sinonimi)
 * so'zlarining hammasi aytilgan bitta menejer bo'lsa — o'sha tanlanadi; bir nechta bo'lsa yoki qisman mos bo'lsa — variantlar.
 */
export function chooseManager<T extends ManagerNode>(nodes: T[], said: string[]): ManagerChoice<T> {
  const asked = [...new Set(said.flatMap(words))];
  const scored = nodes.map((n) => {
    let best = { covered: 0, extra: Infinity };
    for (const variant of [n.name_uz, n.name_ru, n.name_en, ...(n.aliases ?? [])]) {
      if (!variant) continue;
      const ws = words(variant);
      const covered = ws.filter((w) => asked.some((a) => fits(a, w))).length;
      if (!covered) continue;
      const extra = ws.length - covered;
      if (extra < best.extra || (extra === best.extra && covered > best.covered)) best = { covered, extra };
    }
    const popular = POPULAR_MANAGERS.indexOf(n.slug as (typeof POPULAR_MANAGERS)[number]);
    return { n, ...best, popular: popular < 0 ? Infinity : popular };
  });
  // nomining hamma so'zi aytilganlar; ulardan eng ko'p so'zi aytilgani ("ulgurji savdo menejeri" — "Savdo menejeri" emas)
  const full = scored.filter((s) => s.covered > 0 && s.extra === 0);
  const most = Math.max(0, ...full.map((s) => s.covered));
  const exact = full.filter((s) => s.covered === most);
  const order = (a: (typeof scored)[number], b: (typeof scored)[number]) => {
    const ma = a.covered > 0 ? 0 : 1;
    const mb = b.covered > 0 ? 0 : 1;
    if (ma !== mb) return ma - mb;
    if (ma === 0 && a.extra !== b.extra) return a.extra - b.extra;
    if (ma === 0 && a.covered !== b.covered) return b.covered - a.covered;
    if (a.popular !== b.popular) return a.popular - b.popular;
    return a.n.name_uz.localeCompare(b.n.name_uz, "uz");
  };
  const ordered = [...scored].sort(order).map((s) => s.n);
  return { pick: exact.length === 1 ? exact[0]!.n : null, ordered };
}
