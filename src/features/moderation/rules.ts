/**
 * Tezkor qoidalar (AI'dan oldin, sof modul). Ikki daraja:
 *  - block — aniq va xavfli naqsh (masalan "intim xizmat", "zakladchik", "karta sotib olamiz", "Telegram hisobini buzish"):
 *    e'lon AI'ga yuborilmasdan rad etiladi;
 *  - flag  — shubhali signal ("prezident", "18+", "sotiladi", "oldindan to'lov"): faqat AI'ga ishora sifatida beriladi,
 *    yolg'iz o'zi rad etish sababi EMAS (kontekst muhim: "Prezident maktabiga oshpaz kerak" — qonuniy ish).
 * Matn normalizatsiya qilingan (lotin) ko'rinishda tekshiriladi: kirill, ruscha, "1nt1m", "i.n.t.i.m" ham ushlanadi.
 */
import { extractLinks, moderationVariants } from "./normalize";

export const MODERATION_CATEGORIES = [
  "job_related",
  "sexual_services",
  "extremism",
  "illegal_activity",
  "political_content",
  "religious_propaganda",
  "spam",
  "unrelated",
  "uncertain",
] as const;
export type ModerationCategory = (typeof MODERATION_CATEGORIES)[number];

export interface RuleHit {
  rule: string;
  category: ModerationCategory | "injection";
  severity: "block" | "flag";
  field: string;
}

export interface RulesResult {
  hits: RuleHit[];
  /** birinchi "block" topilmasi (bo'lsa — rad etiladi) */
  block: RuleHit | null;
  /** matnda moderatsiyani chetlab o'tishga urinish ("tekshiruvni o'chir", "ignore previous instructions") */
  injection: boolean;
}

type Rule = { id: string; category: RuleHit["category"]; severity: RuleHit["severity"]; re: RegExp };

const W = "[a-z']*"; // so'z davomi (qo'shimchalar)

const RULES: Rule[] = [
  // --- jinsiy xizmatlar ---
  { id: "sex_intim_service", category: "sexual_services", severity: "block", re: new RegExp(`\\bintim${W}\\b.{0,20}\\b(xizmat|uslug|servis|service|dosug|vstrech|uchrashuv)`) },
  { id: "sex_escort", category: "sexual_services", severity: "block", re: /\b(eskort|escort)[a-z']*\b/ },
  { id: "sex_prostitution", category: "sexual_services", severity: "block", re: /\b(prostitu|fohisha|jalab|shlyux|shlyuh|putan)[a-z']*\b/ },
  { id: "sex_erotic_service", category: "sexual_services", severity: "block", re: new RegExp(`\\b(erotik|erotic|eroticheski)${W}\\b.{0,15}\\b(massa(j|zh)|massag|xizmat|uslug|show|shou|tanets|raqs|video|foto)`) },
  { id: "sex_massage_cont", category: "sexual_services", severity: "block", re: new RegExp(`\\bmassa(j|zh)${W}\\s+(s|bilan)\\s+(prodol(j|zh)|davom)`) },
  { id: "sex_paid", category: "sexual_services", severity: "block", re: /\b(seks|sex)\b.{0,15}\b(xizmat|uslug|service|za\s*den|pullik|uchrashuv)/ },
  { id: "sex_explicit", category: "sexual_services", severity: "block", re: /\b(minet|bdsm|striptiz|strip\s*tiz|onlyfans|only\s*fans)[a-z']*\b/ },
  { id: "sex_leisure", category: "sexual_services", severity: "block", re: /\b(dosug|otdyx|otdyh)\b.{0,10}\b(dlya|uchun)\s+(muj|erkak)/ },
  { id: "sex_by_hour", category: "sexual_services", severity: "block", re: /\b(devushk[a-z]*\s+na\s+(chas|noch)|(soatbay|soatlik|tunlik)\s+qiz[a-z']*)\b/ },
  { id: "sex_hint", category: "sexual_services", severity: "flag", re: /(\b18\s*\+|\b(intim|erotik|erotic|seksual|sexy|vebkam|webcam|veb\s*model|web\s*model|nyu\s*foto)[a-z']*\b)/ },

  // --- noqonuniy faoliyat ---
  { id: "drugs_courier", category: "illegal_activity", severity: "block", re: /\b(zakladk|zakladchik|kladmen|klad\s*men)[a-z']*\b/ },
  { id: "drugs_names", category: "illegal_activity", severity: "block", re: /\b(mefedron|amfetamin|geroin|kokain|gashish|marixuana|marihuana|ekstazi|anasha)[a-z']*\b/ },
  { id: "drugs_trade", category: "illegal_activity", severity: "block", re: /\bnarko(tik|tiki|tiklar|tiklarni|tikov)?\b.{0,20}\b(sot|tarqat|kuryer|kurer|dostav|yetkaz)/ },
  { id: "cards_buy", category: "illegal_activity", severity: "block", re: new RegExp(`\\b(karta|kartalar|plastik|bank\\s*kart)${W}\\b.{0,25}\\b(sotib\\s*olamiz|sotib\\s*olaman|ijaraga|arendaga|arenda|kuplyu|pokupa|skupka|skupaem|oformi[a-z]*\\s+na\\s+seb)`) },
  { id: "cards_drop", category: "illegal_activity", severity: "block", re: /\b(obnal|obnalichk|otmyv|dropper|drop\s*(kart|schet|akkaunt))[a-z']*\b|\bpul\s*yuvish|\bkart[uyaie]?\s+na\s+seb[a-z]*/ },
  { id: "accounts_buy", category: "illegal_activity", severity: "block", re: new RegExp(`\\b(akkaunt|account|sim\\s*kart)${W}\\b.{0,15}\\b(sotib\\s*olamiz|sotamiz|kuplyu|skupka|skupaem)`) },
  { id: "forgery", category: "illegal_activity", severity: "block", re: new RegExp(`\\b(soxta|qalbaki|falshiv|poddel|lipov|fejk|fake)${W}\\b.{0,20}\\b(diplom|pasport|hujjat|guvohnoma|spravk|dokument|prava|sertifikat|ma'lumotnoma)`) },
  { id: "forgery_buy", category: "illegal_activity", severity: "block", re: /\b(kupit|sotib\s*olish)\s+(diplom|prava|spravk)/ },
  { id: "hacking_object", category: "illegal_activity", severity: "block", re: new RegExp(`\\b(telegram|instagram|whatsapp|facebook|akkaunt|account|parol|pochta|stranits|stranic|sahifa)${W}\\b.{0,25}\\b(buz(ish|adigan|ib|uvchi|ing)|vzlom|xakerlik|hack)`) },
  { id: "hacking_verb", category: "illegal_activity", severity: "block", re: new RegExp(`\\b(vzlom${W}|buzish|buzadigan|hack${W})\\b.{0,25}\\b(telegram|instagram|whatsapp|facebook|akkaunt|account|stranits|stranic|parol)`) },
  { id: "hacking_tools", category: "illegal_activity", severity: "block", re: /\b(karding|carding|phishing|fishing\s+(sayt|link|stranic)|ddos\s*(xizmat|uslug|atak))[a-z']*\b/ },
  { id: "scam_prepay", category: "illegal_activity", severity: "flag", re: /(oldindan\s*to'?lov|oldindan\s*pul|depozit|zalog|garov\s+pul|pullik\s+o'qish|forma\s+uchun\s+pul|predoplat|platnoe\s+obuchenie|vstupitel[a-z]*\s+vznos)/ },
  { id: "weapons", category: "illegal_activity", severity: "flag", re: /\b(qurol|oruzh|pistolet|patron)[a-z']*\b.{0,15}\b(sot|kupl|prodaj)/ },

  // --- ekstremizm / zo'ravonlik ---
  { id: "extremism_jihad", category: "extremism", severity: "block", re: new RegExp(`\\b(jihod|jixod|dzhihad|djihad)${W}\\b.{0,20}\\b(qil|chaqir|safi|kel|qo'shil)`) },
  { id: "extremism_orgs", category: "extremism", severity: "block", re: /\b(islomiy\s+davlat|igil|daish|isis|hizb\s*ut\s*-?\s*tahrir|xalifat[a-z']*\s+uchun)\b/ },
  { id: "extremism_terror", category: "extremism", severity: "block", re: new RegExp(`\\bterror${W}\\b.{0,20}\\b(qo'llab|podderzh|podderj|qo'shil|safiga|uyushtir)`) },
  { id: "violence_call", category: "extremism", severity: "block", re: /\b(kofir|kafir)[a-z']*\s+(o'ldir|yo'q\s*qil|ubiva)|\b(o'ldiringlar|portlatinglar|ubivayte|vzryvayte)\b/ },
  { id: "extremism_hint", category: "extremism", severity: "flag", re: /\b(jihod|jixod|shahid|kofir|terror|radikal)[a-z']*\b/ },

  // --- siyosiy / diniy (faqat signal) ---
  { id: "political", category: "political_content", severity: "flag", re: /\b(prezident|mirziyoyev|partiya|saylov|deputat|parlament|oppozitsiya|miting|namoyish|vybor|politik|siyosat|siyosiy)[a-z']*\b/ },
  { id: "religious", category: "religious_propaganda", severity: "flag", re: /(\bnamoz\s+o'qing|\bda'vat|\bimonga\s+keling|\ballohga\s+qayting|\btavba\s+qiling|\bbid'at|\bmissioner|\bpropoved|\bxristian[a-z]*\s+bo'l)/ },

  // --- spam / ishga aloqasiz ---
  { id: "sale", category: "unrelated", severity: "flag", re: /\b(sotiladi|sotaman|sotamiz|optom|prodayu|prodaetsya|prodam|kupite|skidk[a-z]*|aksiya)\b|\barzon\s+narx/ },
  { id: "dating", category: "unrelated", severity: "flag", re: /\b(tanishuv|tanishaman|tanishmoqchi|znakomstv|sovchi|kelin\s+izlay|kuyov\s+izlay)[a-z']*\b|\bish[ck]?u\s+devushk/ },
  { id: "gambling", category: "spam", severity: "flag", re: /\b(kazino|casino|1xbet|melbet|mostbet|pin\s*-?\s*up|bukmeker|ruletk|stavk[a-z]*\s+(sport|qiling|qo'y))[a-z']*\b/ },
  { id: "pyramid", category: "spam", severity: "flag", re: /\b(setevoy\s+marketing|mlm|piramida|passiv\s+daromad|investitsiya\s+qiling|kripto[a-z]*\s+invest)/ },

  // --- tekshiruvni chetlab o'tishga urinish (buyruq emas, ma'lumot) ---
  {
    id: "prompt_injection",
    category: "injection",
    severity: "flag",
    re: /(ignore\s+(all\s+)?(the\s+)?(previous|prior|above)\s+(instructions?|rules)|disregard\s+(the\s+)?(rules|instructions)|oldingi\s+(qoida|ko'rsatma)[a-z']*\s+(unut|e'tiborsiz)|qoidalarni\s+unut|tekshiruvni\s+o'chir|moderatsiya[a-z']*\s+o'chir|bu\s+e'lonni\s+tasdiqla|approve\s+this|mark\s+(it|this)\s+as\s+(safe|allowed|approved)|system\s+prompt|zabud[a-z]*\s+(vse\s+)?(pravila|instrukts)|ignoriru[a-z]*\s+(pravila|instrukts)|odobri\s+eto)/,
  },
];

const SHORTENER_RE = /\b(bit\.ly|tinyurl\.com|cutt\.ly|clck\.ru|goo\.gl|t\.co|is\.gd|shorturl\.at)\//i;
const INVITE_RE = /\bt\.me\/(\+|joinchat)/i;
const PHONE_RE = /(\+?998[\s-]?)?\(?\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g;

function capsRatio(text: string): number {
  const letters = text.replace(/[^a-zA-Zа-яА-ЯёЁ]/g, "");
  if (letters.length < 40) return 0;
  return letters.replace(/[^A-ZА-ЯЁ]/g, "").length / letters.length;
}

/** Bitta maydonni qoidalar bilan tekshirish */
function checkField(field: string, raw: string): RuleHit[] {
  const hits: RuleHit[] = [];
  const variants = moderationVariants(raw);
  for (const rule of RULES) {
    if (variants.some((v) => rule.re.test(v))) hits.push({ rule: rule.id, category: rule.category, severity: rule.severity, field });
  }
  // spam belgilari (asl matnda)
  const links = extractLinks(raw);
  if (links.length > 3) hits.push({ rule: "spam_links", category: "spam", severity: "flag", field });
  if (SHORTENER_RE.test(raw) || INVITE_RE.test(raw)) hits.push({ rule: "spam_short_link", category: "spam", severity: "flag", field });
  if ((raw.match(PHONE_RE) ?? []).length > 3) hits.push({ rule: "spam_phones", category: "spam", severity: "flag", field });
  if (capsRatio(raw) > 0.6) hits.push({ rule: "spam_caps", category: "spam", severity: "flag", field });
  const lines = raw.split(/\n+/).map((l) => l.trim().toLowerCase()).filter((l) => l.length > 8);
  if (lines.length - new Set(lines).size >= 3) hits.push({ rule: "spam_repeat", category: "spam", severity: "flag", field });
  if ((raw.match(/\p{Extended_Pictographic}/gu) ?? []).length > 25) hits.push({ rule: "spam_emoji", category: "spam", severity: "flag", field });
  return hits;
}

/** Barcha maydonlar: { title, profession, employer, description, ... } */
export function checkRules(fields: Record<string, string | null | undefined>): RulesResult {
  const hits: RuleHit[] = [];
  for (const [field, value] of Object.entries(fields)) {
    if (value && value.trim()) hits.push(...checkField(field, value));
  }
  return {
    hits,
    block: hits.find((h) => h.severity === "block") ?? null,
    injection: hits.some((h) => h.category === "injection"),
  };
}
