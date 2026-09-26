import type { TFunction } from "@/lib/i18n/translate";

/**
 * Action xato kodini foydalanuvchi matniga aylantiradi:
 * avval modul kalitlari (`<ns>.errors.<code>`), keyin `common.errors.<code>`, oxirida umumiy xato.
 */
export function actionErrorText(t: TFunction, code: string, ns: "applications" | "offers" = "applications"): string {
  for (const key of [`${ns}.errors.${code}`, `common.errors.${code}`]) {
    const value = t(key);
    if (value !== key) return value;
  }
  return t("common.errors.generic");
}
