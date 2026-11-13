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
  /** qoida nomi; "strict_" bilan boshlansa — qat'iy taqiq (muallif bloklanadi) */
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

/**
 * Qat'iy taqiq (ega, 2026-11-13: "erotika, diniy ekstremizm, qonunga xilof so'zlar umuman ishlatilmasin; massaj, spa kerak
 * emas — hammasi shundan boshlanadi"). Bu so'zlar kontekstidan qat'i nazar "block": e'lon joylanmaydi va muallif bloklanadi
 * (enforce.ts). Yolg'on topilmalardan saqlanish: "seksiya" (bo'lim), "narkolog" (shifokor), "giyohvand moddalar iste'mol
 * qilmaydigan" (talab), "Shahid"/"Mujohid" (ism), IT'dagi "SPA" — bu qoidalarga tushmaydi (testlar: rules.test.ts).
 */
const STRICT: Rule[] = [
  // massaj va spa — har qanday ko'rinishda (massaj, массаж, massajchi, massage, masseur, spa-salon, "relaks salon")
  { id: "strict_massage", category: "sexual_services", severity: "block", re: /\b(mas+a(j|zh)[a-z']*|mas+ag(e|i)[a-z']*|mas+eu(r|se)[a-z']*)\b/ },
  { id: "strict_spa", category: "sexual_services", severity: "block", re: /(\bspa\b[\s-]{0,3}(salon|markaz|center|centr|tsentr|xona|kompleks|protsedur|procedur|xizmat|uslug|terapevt|master|ustas|relaks|relax|administrator|menejer|manager|xodim|ishchi|qiz|devushk|girl|operator)|\b(salon|markaz|centr|tsentr|center|kompleks|mehmonxona)[a-z']*[\s-]{1,3}spa\b|\b(relaks|relax)[a-z']*[\s-]{0,3}(salon|xona|room|markaz|centr|tsentr|center))/ },
  // erotika va jinsiy mazmun — so'zning o'zi yetarli
  { id: "strict_erotic", category: "sexual_services", severity: "block", re: /\b(erot[a-z']*|porn[a-z']*|seks|sex|sexy|seksi|seksual[a-z']*|sexual[a-z']*|intim[a-z']*|striptiz[a-z']*|striptease|strip-?klub|strip-?club|eskort[a-z']*|escort[a-z']*|vebkam[a-z']*|webcam[a-z']*|veb-?model[a-z']*|web-?model[a-z']*|onlyfans|nude|nudes|golaya|golye|yalang'?och[a-z']*|fohisha[a-z']*|jalab[a-z']*|prostitu[a-z']*|bordel[a-z']*|shlyux[a-z']*|shlyuh[a-z']*|putan[a-z']*|lyubovnits[a-z']*)\b/ },
  { id: "strict_dating_paid", category: "sexual_services", severity: "block", re: /\b(vip\s*(qiz|devushk|girl)[a-z']*|sponsor\s*(izlay|ishchu|kerak)|soderzhank[a-z']*)\b/ },
  // diniy ekstremizm, terror va zo'ravonlik (ism bo'lishi mumkin bo'lgan yalang'och shakllar — "Jihod", "Mujohid", "Shahid" — kirmaydi)
  { id: "strict_extremism", category: "extremism", severity: "block", re: /\b((ji[xh]o?d|ji[xh]ad|dji[xh]ad|dzhihad|dzhixad)(ga|chi[a-z']*|iy[a-z']*|ist[a-z']*|da|ni|ning|qa)|g'azot[a-z']*|muqaddas\s+urush|xalifat[a-z']*|xalifalik|islomiy\s+davlat|igil|daish|isis|hizb[\s-]*ut[\s-]*tahrir|hizbut[a-z']*|akromiy[a-z']*|vah+obiy[a-z']*|vah+abit[a-z']*|salafiy[a-z']*|takfir[a-z']*|tablig'?i?\s+jamoat|nurchi[a-z']*|shahidlik[a-z']*|shahid\s+bo'l[a-z']*|mujohidlar[a-z']*|kofirlar(ni|ga|ning)?|terakt[a-z']*|terrorchi[a-z']*|terrorist[a-z']*|ekstremist[a-z']*|boyevik[a-z']*)\b/ },
  // diniy targ'ibot (da'vat) — ish e'lonida joyi yo'q
  { id: "strict_religious", category: "religious_propaganda", severity: "block", re: /(\bnamoz\s+o'qing|\bda'?vat\s*(qil|ga|chi)[a-z']*|\bimonga\s+keling|\ballohga\s+qayting|\btavba\s+qiling|\bmissioner[a-z']*|\bpropoved[a-z']*|\bxristian[a-z]*\s+bo'l|\bsektaga|\bsekta\s+a'zo)/ },
  // giyohvand moddalar (nomlari; "narkolog", talablardagi "iste'mol qilmaydigan", ziravor "spice" kirmaydi)
  { id: "strict_drugs", category: "illegal_activity", severity: "block", re: /\b(spays[a-z']*|kuritel[a-z']*\s+smes[a-z']*|metamfetamin[a-z']*|metadon[a-z']*|lsd|travk[ua]\s+(sot|prodam|prodaj))\b/ },
  // qurol savdosi, qimor, a'zo savdosi
  { id: "strict_weapons", category: "illegal_activity", severity: "block", re: /\b(qurol|oruzh|pistolet|patron|avtomat\s+kalashnikov|granat)[a-z']*\b.{0,20}\b(sotaman|sotamiz|sotiladi|sotib\s*olamiz|kuplyu|prodaj[a-z']*|prodam|prodayu|yetkazaman)\b/ },
  { id: "strict_gambling", category: "illegal_activity", severity: "block", re: /\b(kazino|casino|1xbet|1x\s*bet|melbet|mostbet|bukmeker[a-z']*|ruletk[a-z']*|slot\s*(o'yin|mashin|avtomat)[a-z']*|onlayn\s+qimor|qimor[a-z']*)\b/ },
  { id: "strict_organs", category: "illegal_activity", severity: "block", re: /\b(buyrak|buyragimni|pochk[ua]|pechen|organ(lar|larni|ni)?)\b.{0,15}\b(sotaman|sotamiz|sotiladi|sotib\s*olamiz|prodam|prodayu|kuplyu|donor\s+kerak)\b/ },
];

const RULES: Rule[] = [
  ...STRICT,
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
  // "giyohvand (modda) sotaman / tarqataman / yetkazaman" (kirill matn ham lotinga o'tkazib tekshiriladi)
  { id: "drugs_trade_uz", category: "illegal_activity", severity: "block", re: /\bgiyohvand[a-z']*\b.{0,25}\b(sot|tarqat|kuryer|kurer|yetkaz|dostav)/ },
  { id: "cards_buy", category: "illegal_activity", severity: "block", re: new RegExp(`\\b(karta|kartalar|plastik|bank\\s*kart)${W}\\b.{0,25}\\b(sotib\\s*olamiz|sotib\\s*olaman|ijaraga|arendaga|arenda|kuplyu|pokupa|skupka|skupaem|oformi[a-z]*\\s+na\\s+seb)`) },
  { id: "cards_drop", category: "illegal_activity", severity: "block", re: /\b(obnal|obnalichk|otmyv|dropper|drop\s*(kart|schet|akkaunt))[a-z']*\b|\bpul\s*yuvish|\bkart[uyaie]?\s+na\s+seb[a-z]*/ },
  { id: "accounts_buy", category: "illegal_activity", severity: "block", re: new RegExp(`\\b(akkaunt|account|sim\\s*kart)${W}\\b.{0,15}\\b(sotib\\s*olamiz|sotamiz|kuplyu|skupka|skupaem)`) },
  { id: "forgery", category: "illegal_activity", severity: "block", re: new RegExp(`\\b(soxta|qalbaki|falshiv|poddel|lipov|fejk|fake)${W}\\b.{0,20}\\b(diplom|pasport|hujjat|guvohnoma|spravk|dokument|prava|sertifikat|ma'lumotnoma)`) },
  { id: "forgery_buy", category: "illegal_activity", severity: "block", re: /\b(kupit|sotib\s*olish)\s+(diplom|prava|spravk)/ },
  { id: "hacking_object", category: "illegal_activity", severity: "block", re: new RegExp(`\\b(telegram|instagram|whatsapp|facebook|akkaunt|account|parol|pochta|stranits|stranic|sahifa)${W}\\b.{0,25}\\b(buz(ish|adigan|ib|uvchi|ing)|vzlom|xakerlik|hack)`) },
  { id: "hacking_verb", category: "illegal_activity", severity: "block", re: new RegExp(`\\b(vzlom${W}|buzish|buzadigan|hack${W})\\b.{0,25}\\b(telegram|instagram|whatsapp|facebook|akkaunt|account|stranits|stranic|parol)`) },
  { id: "hacking_tools", category: "illegal_activity", severity: "block", re: /\b(karding|carding|phishing|fishing\s+(sayt|link|stranic)|ddos\s*(xizmat|uslug|atak))[a-z']*\b/ },
  { id: "scam_prepay", category: "illegal_activity", severity: "flag", re: /(oldindan\s*to'?lov|oldindan\s*pul|depozit|zalog|garov\s+pul|pullik\s+o'qish|forma\s+uchun\s+pul|predoplat|platnoe\s+obuchenie|vstupitel[a-z]*\s+vznos)/ },

  // --- ekstremizm / zo'ravonlik ---
  { id: "extremism_jihad", category: "extremism", severity: "block", re: new RegExp(`\\b(jihod|jixod|dzhihad|djihad)${W}\\b.{0,20}\\b(qil|chaqir|safi|kel|qo'shil)`) },
  { id: "extremism_orgs", category: "extremism", severity: "block", re: /\b(islomiy\s+davlat|igil|daish|isis|hizb\s*ut\s*-?\s*tahrir|xalifat[a-z']*\s+uchun)\b/ },
  { id: "extremism_terror", category: "extremism", severity: "block", re: new RegExp(`\\bterror${W}\\b.{0,20}\\b(qo'llab|podderzh|podderj|qo'shil|safiga|uyushtir)`) },
  { id: "violence_call", category: "extremism", severity: "block", re: /\b(kofir|kafir)[a-z']*\s+(o'ldir|yo'q\s*qil|ubiva)|\b(o'ldiringlar|portlatinglar|ubivayte|vzryvayte)\b/ },
  { id: "extremism_hint", category: "extremism", severity: "flag", re: /\b(jihod|jixod|shahid|kofir|terror|radikal)[a-z']*\b/ },

  // --- siyosiy / diniy (faqat signal) ---
  { id: "political", category: "political_content", severity: "flag", re: /\b(prezident|mirziyoyev|partiya|saylov|deputat|parlament|oppozitsiya|miting|namoyish|vybor|politik|siyosat|siyosiy)[a-z']*\b/ },
  { id: "religious", category: "religious_propaganda", severity: "flag", re: /(\bda'vat|\bbid'at)/ },

  // --- spam / ishga aloqasiz ---
  { id: "sale", category: "unrelated", severity: "flag", re: /\b(sotiladi|sotaman|sotamiz|optom|prodayu|prodaetsya|prodam|kupite|skidk[a-z]*|aksiya)\b|\barzon\s+narx/ },
  { id: "dating", category: "unrelated", severity: "flag", re: /\b(tanishuv|tanishaman|tanishmoqchi|znakomstv|sovchi|kelin\s+izlay|kuyov\s+izlay)[a-z']*\b|\bish[ck]?u\s+devushk/ },
  { id: "gambling", category: "spam", severity: "flag", re: /\b(pin\s*-?\s*up|stavk[a-z]*\s+(sport|qiling|qo'y))[a-z']*\b/ },
  { id: "trafficking", category: "illegal_activity", severity: "flag", re: /\b(chet\s*elga|xorijga|turkiyaga|dubayga|dubaiga|za\s*granits[a-z]*|v\s+(turtsiy|dubai|oae))\b.{0,30}\b(qiz(lar)?|devushk[a-z]*|ayol(lar)?)\b.{0,20}\b(kerak|ishga|nujn)/ },
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
