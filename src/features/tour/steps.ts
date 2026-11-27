/**
 * Birinchi kirgandagi tanishtiruv (ega, 2026-11-19: "1-chi kirganlarga tugmalar vazifasini tushuntirsin — o'sha tilda,
 * ovozlarini men yozib beraman"). Tugmalar navbat bilan yoritiladi, ostida qisqa tushuntirish; ovoz bo'lsa — o'qiladi.
 *
 * Har panel (ish izlovchi / ish beruvchi) uchun bir marta: tugagach yoki "O'tkazib yuborish" bosilsa cookie'ga yoziladi.
 * Qadamning maqsadi `[data-tour="…"]` belgili element; ekranda ko'rinmasa (mehmonda "Xabarlar" yo'q, telefonda/kompyuterda
 * boshqa joyda) — qadam o'tkazib yuboriladi. Matnlar: easy.tour.steps.<kod>; ovozlar: public/tour/<til>/<kod>.mp3.
 */
export type TourPanel = "worker" | "employer";

export interface TourStep {
  /** easy.tour.steps.<code> va ovoz fayli nomi */
  code: string;
  /** [data-tour] qiymati; null — ekran o'rtasidagi karta (salom / yakun) */
  target: string | null;
}

/**
 * 2026-11-22 (ega: "ilovaga kirganda ovozli tushuntirsin, tugmalar nima vazifani bajarishini — uni ham ovozini ber"):
 * chat tepasidagi video-tushuntirishdan keyin — hozirgi tugmalar: bosh ekrandagi uchta katta tugma (2026-11-23: + sariq
 * "E'lon berish"), qidiruv qatori, asosiy menyu (Qidiruv · E'lonlarim · Profil), keyin yuqori panel: xabarlar, til, kirish,
 * qo'ng'iroqcha.
 * Ikkala panelda bir xil (bosh ekran ikkalasida ham bir xil); ko'rilgani panel bo'yicha alohida eslab qolinadi.
 */
const STEPS: readonly TourStep[] = [
  { code: "B0", target: null },
  // ekrandagi tartibda (ega, 2026-11-27): tepada «Ishchi qidiryapman», ostida yashil «Ish qidiryapman»
  { code: "B2", target: "start-workers" },
  { code: "B1", target: "start-jobs" },
  // "E'lon berish": bosh ekrandagi sariq tugma (2026-11-23, uchinchi tugma) — kompyuterda yuqori paneldagisi
  { code: "B6", target: "post" },
  // yozish: bosh ekranda — qidiruv qatori, suhbatda — pastdagi maydon
  { code: "B3", target: "composer" },
  { code: "B4", target: "chat" },
  { code: "B5", target: "my-listings" },
  { code: "B7", target: "profile" },
  // yuqori panel: xabarlar, til, kirish, qo'ng'iroqcha
  { code: "U4", target: "messages" },
  { code: "U2", target: "lang" },
  { code: "U3", target: "login" },
  { code: "U5", target: "bell" },
  { code: "U6", target: null },
];

export const TOUR_STEPS: Record<TourPanel, readonly TourStep[]> = { worker: STEPS, employer: STEPS };

/** tanishuv ovozi yoqilgan/o'chirilgan (localStorage); video-tushuntirishdagi birinchi tanlov ham shu yerga yoziladi */
export const TOUR_SOUND_KEY = "ishuz:tour-sound";

/** Ko'rilgan panellar: "w", "e" yoki "we" */
export const TOUR_COOKIE = "ib_tour";
export const TOUR_DONE_EVENT = "ib:tour-done";

export function panelLetter(panel: TourPanel): "w" | "e" {
  return panel === "employer" ? "e" : "w";
}

export function tourSeen(cookieValue: string | null | undefined, panel: TourPanel): boolean {
  return !!cookieValue && cookieValue.includes(panelLetter(panel));
}

export function markTourSeen(cookieValue: string | null | undefined, panel: TourPanel): string {
  const letters = new Set((cookieValue ?? "").replace(/[^we]/g, "").split("").filter(Boolean));
  letters.add(panelLetter(panel));
  return ["w", "e"].filter((l) => letters.has(l)).join("");
}

/**
 * Yozib qo'yilgan ovozlar (ega yuboradi). O'zbekcha ovoz lotin va kirill uchun bitta (oz → uz). Ro'yxatda yo'q kod
 * uchun so'rov yuborilmaydi — tanishtiruv faqat matn bilan ishlaydi.
 */
export const TOUR_AUDIO: Partial<Record<"uz" | "ru" | "en", readonly string[]>> = {
  // ega yuborgan ElevenLabs yozuvlari ("Farruh — Confident"): U2–U6 — 2026-11-19 dagi yozuvdan; B0–B7 — 2026-11-22
  uz: ["B0", "B1", "B2", "B3", "B4", "B5", "B6", "B7", "U2", "U3", "U4", "U5", "U6"],
};

export function tourAudioSrc(locale: string, code: string): string | null {
  const lang = locale === "oz" ? "uz" : locale;
  if (lang !== "uz" && lang !== "ru" && lang !== "en") return null;
  return TOUR_AUDIO[lang]?.includes(code) ? `/tour/${lang}/${code}.mp3` : null;
}
