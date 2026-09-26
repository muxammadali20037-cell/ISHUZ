import type { TFunction } from "@/lib/i18n/translate";

/** Action xato kodi → matn: avval profile.errors, keyin common.errors, aks holda generic */
export function actionErrorMessage(t: TFunction, code: string, params?: Record<string, string | number>): string {
  for (const key of [`profile.errors.${code}`, `common.errors.${code}`]) {
    const v = t(key, params);
    if (v !== key) return v;
  }
  return t("common.errors.generic");
}
