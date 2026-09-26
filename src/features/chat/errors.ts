import type { TFunction } from "@/lib/i18n/translate";

/** Xatolik kodi → matn: avval chat.errors, keyin common.errors, oxirida umumiy */
export function chatErrorText(t: TFunction, code: string | undefined): string {
  const safe = (code ?? "").replace(/[^a-z_]/g, "");
  if (safe) {
    const own = `chat.errors.${safe}`;
    const ownText = t(own);
    if (ownText !== own) return ownText;
    const common = `common.errors.${safe}`;
    const commonText = t(common);
    if (commonText !== common) return commonText;
  }
  return t("chat.errors.generic");
}
