import type { TFunction } from "@/lib/i18n/translate";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | undefined | null): value is string {
  return !!value && UUID_RE.test(value);
}

/** Action xato kodi → matn: avval modul kalitlari, keyin common, oxirida generic */
export function errorMessage(t: TFunction, code: string): string {
  const own = `vacancies.errors.${code}`;
  const ownText = t(own);
  if (ownText !== own) return ownText;
  const common = `common.errors.${code}`;
  const commonText = t(common);
  if (commonText !== common) return commonText;
  return t("common.errors.generic");
}

/** Yandex xarita havolasi (pt = lng,lat) — xarita embed qilinmaydi, faqat tekshirish uchun */
export function yandexMapsUrl(lat: number, lng: number): string {
  return `https://yandex.uz/maps/?pt=${lng.toFixed(6)},${lat.toFixed(6)}&z=16&l=map`;
}

/** "08:00:00" (Postgres time) → "08:00"; bo'sh → "" */
export function toHHMM(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : "";
}
