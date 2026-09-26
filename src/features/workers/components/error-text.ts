import type { TFunction } from "@/lib/i18n/translate";

/** Modul kalitlari (workers.errors.*) — qolganlari common.errors.* dan olinadi */
const MODULE_ERRORS = new Set([
  "already_offered",
  "vacancy_not_active",
  "worker_not_found",
  "title_required",
  "employer_only",
  "employer_profile_required",
  "salary_range",
  "not_saved",
  "not_found",
]);

const COMMON_ERRORS = new Set(["generic", "network", "forbidden", "not_authenticated", "rate_limited", "blocked", "validation", "required"]);

/** Xatolik kodi → foydalanuvchiga matn */
export function errorText(t: TFunction, code: string | null | undefined): string {
  if (code && MODULE_ERRORS.has(code)) return t(`workers.errors.${code}`);
  if (code && COMMON_ERRORS.has(code)) return t(`common.errors.${code}`);
  return t("common.errors.generic");
}
