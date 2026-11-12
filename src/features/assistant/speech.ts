import type { AssistantLang } from "./types";

/**
 * Javobni ovoz bilan o'qib berish (brauzerning o'z ovozi — Web Speech API) uchun sof yordamchilar.
 * Qurilmada shu til uchun ovoz bo'lmasa — o'qilmaydi (boshqa tilning ovozi bilan buzib o'qib bermaymiz); faqat o'zbek
 * kirill matni uchun, o'zbekcha ovoz bo'lmasa, ruscha ovoz ishlatiladi (harflar deyarli bir xil o'qiladi).
 */
export interface VoiceLike {
  lang: string;
  name: string;
  default?: boolean;
  localService?: boolean;
}

const PREFER: Record<AssistantLang, string[]> = { uz: ["uz"], oz: ["uz", "ru"], ru: ["ru"], en: ["en"] };

export function pickVoice<V extends VoiceLike>(voices: readonly V[], lang: AssistantLang): V | null {
  for (const prefix of PREFER[lang]) {
    const list = voices.filter((v) => v.lang.toLowerCase().replace("_", "-").split("-")[0] === prefix);
    if (list.length) return list.find((v) => v.default) ?? list.find((v) => v.localService) ?? list[0]!;
  }
  return null;
}

const MAX_SPOKEN = 700;

/** O'qiladigan matn: belgilar (*, #, havolalar) olib tashlanadi; juda uzun bo'lsa — gap chegarasida kesiladi */
export function speakable(text: string): string {
  const clean = text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[*_#`>|~]+/g, " ")
    .replace(/^\s*[-•–]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= MAX_SPOKEN) return clean;
  const cut = clean.slice(0, MAX_SPOKEN);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return end > 200 ? cut.slice(0, end + 1) : cut;
}
