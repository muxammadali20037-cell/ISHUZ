/**
 * Ish beruvchiga ko'rinadigan sabablar uchinchi shaxsda: "Kasbingiz mos" emas, "Kasbi mos".
 * Ro'yxat `messages/*\/enums.json` → `match_reason_employer` bilan bir xil (unit test tekshiradi).
 */
export const EMPLOYER_REASON_KEYS = new Set([
  "category_match",
  "district_match",
  "distance_near",
  "distance_ok",
  "salary_ok",
  "salary_min_ok",
  "salary_unspecified",
  "salary_below",
  "salary_close",
  "experience_ok",
  "schedule_ok",
  "remote_preferred",
  "remote_not_preferred",
  "profession_exact",
  "profession_specialist",
  "profession_general",
]);

export type ReasonPerspective = "worker" | "employer";

/** Moslik sababi kaliti → tarjima kaliti. Ish beruvchi uchun alohida matn bo'lmasa — umumiy (neytral) matn */
export function matchReasonKey(key: string, perspective: ReasonPerspective = "worker"): string {
  return perspective === "employer" && EMPLOYER_REASON_KEYS.has(key) ? `enums.match_reason_employer.${key}` : `enums.match_reason.${key}`;
}
