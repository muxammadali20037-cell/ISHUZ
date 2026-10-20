/**
 * Yuborish paytidagi tekshiruvlar (navbatga qo'yilgandan keyin vaziyat o'zgargan bo'lishi mumkin: e'lon yopilgan,
 * muddati o'tgan, foydalanuvchi bloklangan). Sof funksiyalar — telegram-dispatch va unit testlar uchun.
 */

/**
 * E'lon hali taklif qilsa bo'ladimi: faol va muddati o'tmagan. `expire_vacancies` holatni soatiga bir marta o'zgartiradi,
 * shuning uchun faqat `status` ga ishonib bo'lmaydi — muddati o'tgan, lekin hali "active" turgan e'lon ham bo'ladi.
 */
export function vacancyStillOpen<T extends { status: string | null; expires_at: string | null }>(v: T | null | undefined, now = Date.now()): v is T {
  if (!v || v.status !== "active") return false;
  if (!v.expires_at) return true;
  const at = Date.parse(v.expires_at);
  return Number.isNaN(at) || at > now;
}

/** Bildirishnoma havolasidagi e'lon: "/jobs/<slug>" (ixtiyoriy so'rov qismi bilan) → slug; boshqa havola — null */
export function jobSlugFromLink(link: string | null | undefined): string | null {
  const m = /^\/jobs\/([^/?#]+)(?:[?#].*)?$/.exec(link ?? "");
  return m ? decodeURIComponent(m[1]!) : null;
}
