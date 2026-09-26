import type { TFunction } from "@/lib/i18n/translate";

/** Xato kodi → matn: avval modul kaliti, keyin common.errors, aks holda generic */
export function errorMessage(t: TFunction, code: string, prefix?: string): string {
  const safe = /^[a-z_]+$/.test(code) ? code : "generic";
  if (prefix) {
    const key = `${prefix}.${safe}`;
    const text = t(key);
    if (text !== key) return text;
  }
  const commonKey = `common.errors.${safe}`;
  const common = t(commonKey);
  if (common !== commonKey) return common;
  if (prefix) {
    const fallback = t(`${prefix}.generic`);
    if (fallback !== `${prefix}.generic`) return fallback;
  }
  return t("common.errors.generic");
}
