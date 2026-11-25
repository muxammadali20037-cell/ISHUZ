/**
 * Do'kon tekshiruvchisining demo hisobi (store-review.ts): doimiy id — server faqat shu id bilan yaratadi,
 * kanal avtopostlari esa shu hisob e'lonlarini o'tkazib yuboradi (tekshiruvchining sinov e'lonlari kanalga chiqmasin).
 */
export const STORE_REVIEW_PROFILE_ID = "5e1f2e71-0000-4000-8000-000000000001";
/** texnik manzil (telegram.ishuz.local — profil kontaktlariga yozilmaydi, xat yuborilmaydi) */
export const STORE_REVIEW_EMAIL = "store-review@telegram.ishuz.local";

/** Ikkalasi ham to'g'ri berilgan va raqam egasiniki emas — yoqiq */
export function storeReviewEnabled(phone: string | null, code: string | undefined, ownerPhones: string[]): boolean {
  return !!phone && !!code && /^\d{6}$/.test(code) && !ownerPhones.includes(phone);
}
