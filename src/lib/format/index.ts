import { formatInTimeZone } from "date-fns-tz";
import { formatDistanceToNowStrict } from "date-fns";
import { ru as ruLocale, uz as uzLocale } from "date-fns/locale";
import { parsePhoneNumberFromString, AsYouType } from "libphonenumber-js";
import type { Locale } from "@/lib/i18n/config";

export const TASHKENT_TZ = "Asia/Tashkent";

/** 5000000 → "5 000 000 so'm" (ru: "5 000 000 сум") */
export function formatMoney(amount: number | null | undefined, locale: Locale = "uz", opts: { withCurrency?: boolean } = {}): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "";
  const n = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  if (opts.withCurrency === false) return n;
  return `${n} ${locale === "ru" ? "сум" : "so'm"}`;
}

/** Maosh oralig'i: "5 000 000 – 7 000 000 so'm", "5 000 000 so'm dan", "Kelishiladi" */
export function formatSalaryRange(
  from: number | null | undefined,
  to: number | null | undefined,
  locale: Locale,
  labels: { negotiable: string; from: string; to: string },
): string {
  if (!from && !to) return labels.negotiable;
  if (from && to) {
    if (from === to) return formatMoney(from, locale);
    return `${formatMoney(from, locale, { withCurrency: false })} – ${formatMoney(to, locale)}`;
  }
  if (from) return `${labels.from} ${formatMoney(from, locale)}`;
  return `${labels.to} ${formatMoney(to, locale)}`;
}

/** Qisqa ko'rinish: 5 000 000 → "5 mln", 750 000 → "750 ming" */
export function formatMoneyShort(amount: number | null | undefined, locale: Locale = "uz"): string {
  if (!amount) return "";
  const mln = locale === "ru" ? "млн" : "mln";
  const thousand = locale === "ru" ? "тыс." : "ming";
  if (amount >= 1_000_000) {
    const v = amount / 1_000_000;
    return `${Number.isInteger(v) ? v : v.toFixed(1).replace(/\.0$/, "")} ${mln}`;
  }
  if (amount >= 1000) return `${Math.round(amount / 1000)} ${thousand}`;
  return String(amount);
}

/** "+998901234567" → "+998 90 123 45 67" */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const parsed = parsePhoneNumberFromString(phone, "UZ");
  return parsed ? parsed.formatInternational() : phone;
}

/** Foydalanuvchi kiritganini E.164 ga keltiradi; noto'g'ri bo'lsa null */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  const candidate = digits.startsWith("+") ? digits : digits.startsWith("998") ? `+${digits}` : `+998${digits}`;
  const parsed = parsePhoneNumberFromString(candidate, "UZ");
  if (!parsed || !parsed.isValid() || parsed.country !== "UZ") return null;
  return parsed.number;
}

/** Yozish paytida formatlash (input uchun) */
export function formatPhoneAsYouType(input: string): string {
  return new AsYouType("UZ").input(input);
}

const dateLocales = { uz: uzLocale, ru: ruLocale };

/** ISO → "26 sentabr 2026" (Toshkent vaqti) */
export function formatDate(iso: string | Date | null | undefined, locale: Locale = "uz", pattern = "d MMMM yyyy"): string {
  if (!iso) return "";
  return formatInTimeZone(new Date(iso), TASHKENT_TZ, pattern, { locale: dateLocales[locale] });
}

export function formatDateTime(iso: string | Date | null | undefined, locale: Locale = "uz"): string {
  return formatDate(iso, locale, "d MMM yyyy, HH:mm");
}

export function formatTime(iso: string | Date | null | undefined): string {
  return formatDate(iso, "uz", "HH:mm");
}

/** "3 soat oldin" / "3 часа назад" */
export function formatRelative(iso: string | Date | null | undefined, locale: Locale = "uz"): string {
  if (!iso) return "";
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: true, locale: dateLocales[locale] });
}

/** "08:00:00" (Postgres time) → "08:00" */
export function formatWorkTime(time: string | null | undefined): string {
  if (!time) return "";
  return time.slice(0, 5);
}

/** Tug'ilgan sanadan yosh */
export function ageFromBirthDate(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

/** Masofa: 1.83 → "1.8 km" */
export function formatDistance(km: number | null | undefined, locale: Locale = "uz"): string {
  if (km === null || km === undefined) return "";
  const unit = locale === "ru" ? "км" : "km";
  if (km < 1) return `${Math.round(km * 1000)} ${locale === "ru" ? "м" : "m"}`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} ${unit}`;
}

/** "Ali Valiyev" → "AV" */
export function initials(first?: string | null, last?: string | null): string {
  return `${(first ?? "").trim().charAt(0)}${(last ?? "").trim().charAt(0)}`.toUpperCase() || "?";
}

export function fullName(first?: string | null, last?: string | null): string {
  return [first, last].filter(Boolean).join(" ").trim();
}

/** Familiyani qisqartirish: "Ali Valiyev" → "Ali V." (nomzod kartasi uchun) */
export function shortName(first?: string | null, lastInitial?: string | null): string {
  return lastInitial ? `${first ?? ""} ${lastInitial}.`.trim() : (first ?? "");
}
