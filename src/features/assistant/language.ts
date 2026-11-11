import type { AssistantLang } from "./types";

/**
 * Foydalanuvchi xabarining tili va yozuvi: o'zbek lotin (uz), o'zbek kirill (oz), rus (ru), ingliz (en).
 * Sof funksiya (AI'siz): javob tili shu bilan tanlanadi — AI ishlamaganda ham foydalanuvchi o'z tilida javob oladi.
 * Aniqlab bo'lmasa (bitta so'z, son, ism) — `fallback` (oldingi xabar tili yoki sayt tili).
 */
const UZ_CYR_LETTERS = /[ўқғҳ]/i;
const UZ_CYR_WORDS = /(^|[^\p{L}])(иш|ишга|иши|керак|борми|бор|менга|мен|учун|билан|салом|раҳмат|рахмат|қандай|қаерда|ойлик|кунлик|маош|ходим|ишчи|топиб|беринг|йўқ|ҳам|ёки|яхши|қидиряпман|излаяпман)([^\p{L}]|$)/iu;
const RU_WORDS = /(^|[^\p{L}])(работа|работу|работы|ищу|нужен|нужна|нужно|нужны|есть|для|или|как|где|зарплата|привет|здравствуйте|спасибо|вакансия|вакансии|сотрудник|опыт|без|хочу|можно|пожалуйста|что|это|мне|найти|подскажите)([^\p{L}]|$)/iu;
const EN_WORDS = /(^|[^\p{L}])(the|job|jobs|work|need|looking|for|find|hello|hi|please|thanks|thank|salary|experience|with|without|and|can|you|what|how|where|want|hire|worker|resume|cv)([^\p{L}]|$)/iu;
const UZ_LAT_WORDS = /(^|[^\p{L}])(ish|ishga|ishi|kerak|bormi|bor|menga|men|uchun|bilan|salom|assalomu|rahmat|qanday|qayerda|oylik|kunlik|maosh|xodim|ishchi|topib|bering|yo'q|yoq|ham|yoki|yaxshi|qidiryapman|izlayapman|kerakmi|qancha|nima|qaysi|tajriba|tajribasiz)([^\p{L}]|$)/iu;
const UZ_LAT_MARKS = /(o'|g'|oʻ|gʻ|o‘|g‘|o’|g’)/i;

export function detectLanguage(text: string, fallback: AssistantLang = "uz"): AssistantLang {
  const s = text.normalize("NFC");
  const cyr = (s.match(/[Ѐ-ӿ]/g) ?? []).length;
  const lat = (s.match(/[A-Za-z]/g) ?? []).length;
  if (cyr === 0 && lat === 0) return fallback;
  if (cyr >= lat) {
    if (UZ_CYR_LETTERS.test(s) || UZ_CYR_WORDS.test(s)) return "oz";
    if (RU_WORDS.test(s)) return "ru";
    // kirill, lekin belgi yo'q (ism, shahar, kasb nomi): oldingi til kirillda bo'lsa — o'sha, aks holda rus
    return fallback === "oz" || fallback === "ru" ? fallback : "ru";
  }
  const uz = UZ_LAT_MARKS.test(s) || UZ_LAT_WORDS.test(s);
  const en = EN_WORDS.test(s);
  if (uz && !en) return "uz";
  if (en && !uz) return "en";
  if (uz && en) return (s.match(new RegExp(UZ_LAT_WORDS.source, "giu")) ?? []).length >= (s.match(new RegExp(EN_WORDS.source, "giu")) ?? []).length ? "uz" : "en";
  // lotin, lekin belgi yo'q ("oshpaz", "Chilonzor"): oldingi til lotinda bo'lsa — o'sha, aks holda o'zbek lotin
  return fallback === "en" || fallback === "uz" ? fallback : "uz";
}

/** Suhbat tili: oxirgi foydalanuvchi xabari; aniqlanmasa — undan oldingilari, eng oxirida sayt tili */
export function conversationLanguage(userTexts: string[], siteLocale: AssistantLang): AssistantLang {
  let lang = siteLocale;
  for (const text of userTexts) lang = detectLanguage(text, lang);
  return lang;
}

export const LANGUAGE_NAME: Record<AssistantLang, string> = {
  uz: "Uzbek in Latin script (o'zbekcha, lotin yozuvi)",
  oz: "Uzbek in Cyrillic script (ўзбекча, кирилл ёзуви)",
  ru: "Russian (русский)",
  en: "English",
};
