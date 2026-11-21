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

export const TOUR_STEPS: Record<TourPanel, readonly TourStep[]> = {
  worker: [
    { code: "W1", target: null },
    { code: "U1", target: "role" },
    // 2026-11-21: asosiy menyu — Chat · E'lonlarim · Profil; "Yordamchi" tushuntirishi endi "Chat" bo'limida
    { code: "W7", target: "chat" },
    { code: "W2", target: "home" },
    { code: "W3", target: "jobs" },
    { code: "W4", target: "employers" },
    { code: "W5", target: "fields" },
    { code: "U4", target: "messages" },
    { code: "W6", target: "profile" },
    { code: "U2", target: "lang" },
    { code: "U3", target: "login" },
    { code: "U5", target: "bell" },
    { code: "U6", target: null },
  ],
  employer: [
    { code: "E1", target: null },
    { code: "U1", target: "role" },
    { code: "E7", target: "chat" },
    { code: "E2", target: "dashboard" },
    { code: "E3", target: "my-listings" },
    { code: "E4", target: "post" },
    { code: "E5", target: "workers" },
    { code: "E6", target: "profile" },
    { code: "U2", target: "lang" },
    { code: "U4", target: "messages" },
    { code: "U3", target: "login" },
    { code: "U5", target: "bell" },
    { code: "U6", target: null },
  ],
};

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
  // ega yuborgan ElevenLabs yozuvi (2026-11-19, "Farruh — Confident"), pauzalar bo'yicha 20 ta qatorga bo'lingan
  uz: ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "E1", "E2", "E3", "E4", "E5", "E6", "E7", "U1", "U2", "U3", "U4", "U5", "U6"],
};

export function tourAudioSrc(locale: string, code: string): string | null {
  const lang = locale === "oz" ? "uz" : locale;
  if (lang !== "uz" && lang !== "ru" && lang !== "en") return null;
  return TOUR_AUDIO[lang]?.includes(code) ? `/tour/${lang}/${code}.mp3` : null;
}
