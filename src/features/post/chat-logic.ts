import type { Enums } from "@/types/database.types";
import type { PickedProfession } from "@/features/professions/types";
import type { PlaceChoice, SimpleExperience } from "./types";

/**
 * "Tez va qulay e'lon — AI bilan" (ish izlovchi): suhbat bir gapdan boshlanadi ("kuryer bo'lib ishlamoqchiman"), keyin yordamchi
 * e'lon uchun yetishmayotgan narsalarni birma-bir so'raydi. Savollar tartibi va javoblarni tekshirish shu yerda (sof funksiyalar):
 * mijoz komponenti ham, testlar ham shundan foydalanadi. Hech narsa o'ylab topilmaydi — e'longa faqat foydalanuvchi aytgani tushadi.
 */
export type ChatField =
  | "profession"
  | "region"
  | "district"
  | "experience"
  | "schedule"
  | "salary"
  | "name"
  | "phone"
  | "about";

export const CHAT_SCHEDULES = [
  "5_2",
  "6_1",
  "2_2",
  "shift",
  "flexible",
] as const;
export type ChatSchedule = (typeof CHAT_SCHEDULES)[number];

export interface ChatCollected {
  profession: PickedProfession | null;
  place: PlaceChoice;
  experience: SimpleExperience | null;
  /** "" — so'ralmagan; "any" — farqi yo'q (e'longa yozilmaydi) */
  schedule: ChatSchedule | "any" | "";
  /** so'mda; "" — so'ralmagan; "negotiable" — kelishiladi (e'longa yozilmaydi) */
  salary: string;
  firstName: string;
  lastName: string;
  phone: string;
  about: string;
}

export const EMPTY_COLLECTED: ChatCollected = {
  profession: null,
  place: {
    regionId: null,
    districtId: null,
    districtChosen: false,
    remote: false,
  },
  experience: null,
  schedule: "",
  salary: "",
  firstName: "",
  lastName: "",
  phone: "",
  about: "",
};

export interface ChatViewer {
  /** profildan ma'lum ism (bo'lsa — so'ralmaydi) */
  firstName: string;
  /** hisobga kirgan va telefoni bor — telefon so'ralmaydi */
  hasPhone: boolean;
}

/** Keyingi savol: majburiylari (kasb, joy, tajriba, ism, telefon, o'zi haqida) va ixtiyoriylari (grafik, maosh — bir marta) */
export function nextField(
  c: ChatCollected,
  viewer: ChatViewer,
): ChatField | null {
  if (!c.profession) return "profession";
  if (!c.place.regionId) return "region";
  if (!c.place.districtChosen) return "district";
  if (!c.experience) return "experience";
  if (!c.schedule) return "schedule";
  if (!c.salary) return "salary";
  if (c.firstName.trim().length < 2 && viewer.firstName.trim().length < 2)
    return "name";
  if (!viewer.hasPhone && !c.phone) return "phone";
  if (c.about.trim().length < 10) return "about";
  return null;
}

/** Nechanchi savol (jarayon ko'rsatkichi uchun): majburiy savollar soni bo'yicha */
export function chatProgress(
  c: ChatCollected,
  viewer: ChatViewer,
): { done: number; total: number } {
  const steps: boolean[] = [
    !!c.profession,
    !!c.place.regionId && c.place.districtChosen,
    !!c.experience,
    !!c.schedule,
    !!c.salary,
    viewer.firstName.trim().length >= 2 || c.firstName.trim().length >= 2,
    viewer.hasPhone || !!c.phone,
    c.about.trim().length >= 10,
  ];
  return { done: steps.filter(Boolean).length, total: steps.length };
}

/** Tajriba (oy) → oddiy tanlov */
export function experienceFromMonths(
  noExperience: boolean,
  months: number | null,
): SimpleExperience | null {
  if (noExperience) return "none";
  if (months === null) return null;
  if (months < 12) return "lt1";
  if (months < 36) return "1_3";
  return "3plus";
}

const NO_EXP =
  /(tajriba(m|si)?\s*(yo['‘’ʻ`]?q|kerak\s+emas)|tajribasiz|yo['‘’ʻ`]?q|ёқ|тажрибасиз|без\s+опыта|нет\s+опыта|no\s+experience|none)/iu;
const YEARS = /(\d+(?:[.,]\d+)?)\s*(yil|йил|год|лет|year)/iu;
const MONTHS = /(\d+)\s*(oy\b|ой\b|месяц|month)/iu;

/** Tajriba savoliga matnli javob: "3 yil", "yo'q", "6 oy", "без опыта" */
export function parseExperienceAnswer(text: string): SimpleExperience | null {
  const t = text.trim();
  const y = YEARS.exec(t);
  if (y)
    return experienceFromMonths(
      false,
      Math.round(Number.parseFloat(y[1]!.replace(",", ".")) * 12),
    );
  const m = MONTHS.exec(t);
  if (m) return experienceFromMonths(false, Number(m[1]));
  if (NO_EXP.test(t)) return "none";
  return null;
}

const NEGOTIABLE =
  /(kelish|келиш|договор|negotiab|farqi\s+yo|фарқи\s+йўқ|не\s+важно|any)/iu;

/**
 * Maosh savoliga javob: "5 mln", "5", "4 500 000", "800 ming", "kelishiladi". Savol maosh haqida bo'lgani uchun "5" — 5 mln,
 * "800" — 800 ming deb olinadi. Natija so'mda (100 ming – 500 mln), aks holda null.
 */
export function parseSalaryAnswer(
  text: string,
): { amount: number } | { negotiable: true } | null {
  const t = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (NEGOTIABLE.test(t)) return { negotiable: true };
  const m =
    /(\d[\d\s.,]*)\s*(mln|million|миллион|млн|m\b|ming|минг|тыс|k\b)?/u.exec(t);
  if (!m) return null;
  const digits = m[1]!.replace(/\s/g, "");
  let n = Number.parseFloat(
    /[.,]\d{1,2}$/.test(digits)
      ? digits.replace(/[.,](\d{1,2})$/, ".$1").replace(/[.,](?=\d{3})/g, "")
      : digits.replace(/[.,]/g, ""),
  );
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = m[2] ?? "";
  if (/^(mln|million|миллион|млн|m)$/.test(unit)) n *= 1_000_000;
  else if (/^(ming|минг|тыс|k)$/.test(unit)) n *= 1_000;
  else if (n <= 100) n *= 1_000_000;
  else if (n < 100_000) n *= 1_000;
  n = Math.round(n);
  return n >= 100_000 && n <= 500_000_000 ? { amount: n } : null;
}

/** Ism savoliga javob: "Aziz", "Mening ismim Aziz Karimov", "Меня зовут Азиз" — 2–40 harf, raqamsiz */
export function parseNameAnswer(
  text: string,
): { firstName: string; lastName: string } | null {
  const cleaned = text
    .replace(
      /(mening\s+)?ismim|исмим|меня\s+зовут|my\s+name\s+is|i\s*['’]?\s*m\b|men\b|мен\b/giu,
      " ",
    )
    .replace(/[.,!?;:"«»]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!cleaned.length || cleaned.length > 3) return null;
  if (cleaned.some((w) => !/^[\p{L}'‘’ʻ`-]{2,40}$/u.test(w))) return null;
  const cap = (w: string) => w.charAt(0).toLocaleUpperCase() + w.slice(1);
  return {
    firstName: cap(cleaned[0]!),
    lastName: cleaned.slice(1).map(cap).join(" "),
  };
}

export type ChatSalary = { amount: number } | { negotiable: true } | null;
export type ChatScheduleValue = Enums<"work_schedule">;

export function isChatSchedule(
  v: string | null | undefined,
): v is ChatSchedule {
  return !!v && (CHAT_SCHEDULES as readonly string[]).includes(v);
}
