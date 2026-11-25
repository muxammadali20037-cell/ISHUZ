import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";
import { normalizePhone } from "@/lib/format";
import { parseOwnerPhones } from "@/features/admin/owner";
import { logSecurityEvent } from "@/lib/security/events";
import { storeReviewEnabled, STORE_REVIEW_EMAIL, STORE_REVIEW_PROFILE_ID } from "./store-review-config";

type AdminClient = ReturnType<typeof createAdminClient>;

export { STORE_REVIEW_PROFILE_ID } from "./store-review-config";

/**
 * Do'kon tekshiruvchisi uchun test kirish (ega, 2026-11-25: Play Market / App Store'ga chiqish).
 * Saytga kirish faqat Telegram orqali — Google/Apple tekshiruvchisida Telegram yo'q. Shuning uchun telefon formasida
 * Vercel'dagi STORE_REVIEW_PHONE + STORE_REVIEW_CODE faqat bitta alohida demo hisobga (doimiy id, real odam emas) kiritadi:
 * - boshqa hech kimning hisobiga kirib bo'lmaydi (Telegram ham, telefon kodi ham ishlatilmaydi);
 * - urinishlar oddiy kod kabi cheklanadi (telefon va IP bo'yicha, noto'g'ri kod — xato hisoblagichiga);
 * - egasining raqami (SUPER_ADMIN_PHONES) berilsa — o'chiq (admin huquqi bilan adashtirmaslik uchun);
 * - har kirish xavfsizlik jurnaliga yoziladi.
 */
export function storeReviewPhone(): string | null {
  const { STORE_REVIEW_PHONE, STORE_REVIEW_CODE, SUPER_ADMIN_PHONES } = getServerEnv();
  const phone = STORE_REVIEW_PHONE ? normalizePhone(STORE_REVIEW_PHONE) : null;
  return storeReviewEnabled(phone, STORE_REVIEW_CODE, parseOwnerPhones(SUPER_ADMIN_PHONES)) ? phone : null;
}

export function isStoreReviewPhone(phone: string): boolean {
  const review = storeReviewPhone();
  return !!review && review === phone;
}

const digest = (s: string) => createHash("sha256").update(`store-review:${s}`).digest();

/** Doimiy vaqtda solishtirish (kod uzunligi ham sizib chiqmaydi) */
export function storeReviewCodeMatches(code: string): boolean {
  const expected = getServerEnv().STORE_REVIEW_CODE;
  if (!expected || !storeReviewPhone()) return false;
  return timingSafeEqual(digest(code), digest(expected));
}

/**
 * Demo hisob: doimiy id bilan faqat server yaratadi (app_metadata.store_review — faqat service role yozadi).
 * Shu id'da boshqa (server yaratmagan) hisob bo'lsa yoki texnik email band bo'lsa — kirish rad etiladi va jurnalga yoziladi.
 */
export async function ensureStoreReviewProfile(admin: AdminClient): Promise<string> {
  const { error } = await admin.auth.admin.createUser({
    id: STORE_REVIEW_PROFILE_ID,
    email: STORE_REVIEW_EMAIL,
    email_confirm: true,
    app_metadata: { store_review: true },
    // tekshiruvchilar odatda ingliz tilida ko'radi; interfeys tilini o'zi almashtira oladi
    user_metadata: { first_name: "App", last_name: "Review", locale: "en" },
  });
  if (!error) return STORE_REVIEW_PROFILE_ID;
  if (!/already/i.test(error.message)) throw new Error(`store_review createUser: ${error.message}`);
  // oldingi kirishda yaratilgan — faqat server belgisi (app_metadata.store_review) bo'lsa qabul qilinadi
  const { data: got } = await admin.auth.admin.getUserById(STORE_REVIEW_PROFILE_ID);
  if (got?.user?.app_metadata?.store_review === true && got.user.email === STORE_REVIEW_EMAIL) return STORE_REVIEW_PROFILE_ID;
  await logSecurityEvent({ type: "auth.store_review_untrusted", severity: "high", reason: "untrusted_existing_user", route: "/api/auth/phone-code/verify", action: "blocked" });
  throw new Error("store_review: untrusted user");
}
