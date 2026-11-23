import type { ListingStateInfo } from "@/features/post/types";
import type { QuickOption } from "./quick-types";

/**
 * Yordamchi orqali ishchi e'loni (ega, 2026-11-17): "«+ E'lon joylash» → yordamchi; «men o'qituvchiman» deb yozadi →
 * kerak bo'lsa «aynan qanday o'qituvchisiz?» variantlari → oyna (oylik maosh kerak emas, telefon raqami) → «Tasdiqlash» →
 * «Sizning e'loningiz shunday ko'rinadi» → «Joylash» → avtomatik tekshiruv → «Tabriklaymiz»".
 * Mijoz va server uchun umumiy turlar (runtime importsiz, faqat sof funksiyalar).
 */

export type PostExperience = "none" | "lt1" | "1_3" | "3plus";
export const POST_EXPERIENCES: readonly PostExperience[] = ["none", "lt1", "1_3", "3plus"];

export interface PostChoice {
  id: string;
  name: string;
}

/** "Aynan qanday o'qituvchisiz?" — variantlar guruhlab (sarlavha: "Chet tillari"; null — guruhning o'zi) */
export interface PostChoiceGroup {
  title: string | null;
  items: PostChoice[];
}

/** Yozilgan matnni tushunish natijasi */
export type PostUnderstood =
  /** boshqa mavzu ("salom", "kimsan", "ob-havo qanday") — oyna chiqmaydi, qisqa javob */
  | { kind: "reply"; reply: string }
  /** kasb aniq emas — variantlar oynasi */
  | { kind: "options"; question: string; groups: PostChoiceGroup[]; form: PostForm }
  /** kasb aniq yoki "ish kerak" (kasb oynada tanlanadi) — darhol e'lon oynasi */
  | { kind: "form"; form: PostForm };

/** E'lon oynasi — oldindan to'ldirilgan javoblar va tanlovlar */
export interface PostForm {
  text: string;
  profession: PostChoice | null;
  regionId: string | null;
  districtId: string | null;
  regions: QuickOption[];
  /** viloyat id → tumanlar */
  districts: Record<string, QuickOption[]>;
  loggedIn: boolean;
  firstName: string;
  lastName: string;
}

export interface PostAnswers {
  professionId: string;
  firstName: string;
  lastName: string;
  regionId: string;
  districtId: string | null;
  experience: PostExperience;
  /**
   * E'londagi raqam — har doim oynada qo'lda yoziladi, majburiy (ega, 2026-11-17: "profildagi nomer emas — xohlasa boshqa
   * nomer, lekin qo'lda yozilsin"). Mehmon uchun kirish sahifasiga ham shu raqam o'tkaziladi.
   */
  phone: string;
  /** "+ Yana raqam" — ixtiyoriy ikkinchi raqam */
  phone2: string | null;
  /** tekshirish oynasida yaratilgan AI rasm qoralamasi (ega, 2026-11-22: "joylashdan oldin") */
  imageDraft?: string | null;
  /** "Izoh" bandlari (ega, 2026-11-22: "obed, yo'lkira tekin…") — e'lon matniga ✅ bilan qo'shiladi */
  notes?: string[];
}

/** "Sizning e'loningiz shunday ko'rinadi" — serverda, joylanadigan matnning o'zi */
export interface PostPreview {
  answers: PostAnswers;
  profession: string;
  /** "Ali V." */
  name: string;
  /** "Toshkent shahri, Chilonzor tumani" */
  place: string;
  about: string;
  loggedIn: boolean;
}

/** Joylash natijasi (haqiqiy holat) */
export interface PostOutcome {
  workerId: string;
  info: ListingStateInfo;
  professionId: string;
  regionId: string;
  /** shu kasb va hududdagi ishlar */
  matchesHref: string;
  /** "Mos ish chiqsa Telegram'da ham xabar" obunasi holati */
  alert: "active" | "needs_bot" | "off";
}

/** Ism-familiya ko'rinishi e'londa: "Ali V." (familiya to'liq ko'rsatilmaydi) */
export function shortName(first: string, last: string): string {
  const f = first.trim();
  const l = last.trim();
  return l ? `${f} ${l[0]!.toUpperCase()}.` : f;
}
