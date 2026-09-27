/**
 * Bildirishnoma matnini (sarlavha + tana + ikonka) type + payload dan yasaydi.
 * Sof funksiya: UI (client/server) va Telegram dispatcher ikkalasi ham shu yerdan foydalanadi.
 * Faqat `t` va `locale` ga bog'liq — kutubxonalarsiz (testlanadi).
 */
import type { TFunction } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";
import type { Enums, Json } from "@/types/database.types";

export type NotificationType = Enums<"notification_type">;

export type NotificationIcon =
  | "application"
  | "status"
  | "offer"
  | "offer_response"
  | "message"
  | "interview"
  | "expiring"
  | "match_vacancy"
  | "match_worker"
  | "verification"
  | "review"
  | "system";

export interface RenderedNotification {
  title: string;
  body: string;
  icon: NotificationIcon;
}

type PayloadRecord = Record<string, unknown>;

function asRecord(payload: Json | PayloadRecord | null | undefined): PayloadRecord {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as PayloadRecord) : {};
}

function str(p: PayloadRecord, key: string): string {
  const v = p[key];
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function num(p: PayloadRecord, key: string): number | null {
  const v = p[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** 5000000 → "5 000 000" (kutubxonasiz; Telegram dispatcher uchun ham) */
function groupThousands(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function salaryText(t: TFunction, from: number | null, to: number | null): string {
  const currency = t("notifications.salary.currency");
  if (from && to) {
    if (from === to) return `${groupThousands(from)} ${currency}`;
    return t("notifications.salary.range", { from: groupThousands(from), to: groupThousands(to), currency });
  }
  if (from) return t("notifications.salary.from", { from: groupThousands(from), currency });
  if (to) return t("notifications.salary.to", { to: groupThousands(to), currency });
  return "";
}

/** ISO sana → "3 oktabr" (Asia/Tashkent). Intl yo'q bo'lsa — ISO kun qismi. */
function dayText(iso: string, locale: Locale): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "uz-UZ", { timeZone: "Asia/Tashkent", day: "numeric", month: "long" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function tEnum(t: TFunction, group: string, value: string): string {
  if (!value) return "";
  const key = `enums.${group}.${value}`;
  const out = t(key);
  return out === key ? value : out;
}

/**
 * renderNotification('application_received', {vacancy_title, worker_name, match_score}, t, 'uz')
 *   → { title: "Yangi ariza: Kassir", body: "Ali V. ariza yubordi · 95% mos", icon: "application" }
 */
export function renderNotification(type: NotificationType, payload: Json | PayloadRecord | null | undefined, t: TFunction, locale: Locale = "uz"): RenderedNotification {
  const p = asRecord(payload);
  const k = `notifications.types.${type}`;

  switch (type) {
    case "application_received": {
      const score = num(p, "match_score");
      const params = { vacancy_title: str(p, "vacancy_title"), worker_name: str(p, "worker_name"), score };
      return { title: t(`${k}.title`, params), body: score !== null ? t(`${k}.body_score`, params) : t(`${k}.body`, params), icon: "application" };
    }
    case "application_status": {
      const status = str(p, "status");
      const params = { vacancy_title: str(p, "vacancy_title"), company_name: str(p, "company_name"), status: tEnum(t, "application_status", status) };
      if (status === "withdrawn") return { title: t(`${k}.title_withdrawn`, params), body: t(`${k}.body_withdrawn`, params), icon: "status" };
      return { title: t(`${k}.title`, params), body: params.company_name ? t(`${k}.body_company`, params) : t(`${k}.body`, params), icon: "status" };
    }
    case "interview_invite": {
      const params = { vacancy_title: str(p, "vacancy_title"), company_name: str(p, "company_name") };
      return { title: t(`${k}.title`, params), body: params.company_name ? t(`${k}.body_company`, params) : t(`${k}.body`, params), icon: "interview" };
    }
    case "offer_received": {
      const salary = salaryText(t, num(p, "salary_from"), num(p, "salary_to"));
      const params = { title: str(p, "title"), company_name: str(p, "company_name"), salary };
      return { title: t(`${k}.title`, params), body: salary ? t(`${k}.body_salary`, params) : t(`${k}.body`, params), icon: "offer" };
    }
    case "offer_response": {
      const status = str(p, "status");
      const params = { title: str(p, "title"), worker_name: str(p, "worker_name"), status: tEnum(t, "offer_status", status) };
      const title = status === "accepted" ? t(`${k}.title_accepted`, params) : status === "declined" ? t(`${k}.title_declined`, params) : t(`${k}.title`, params);
      return { title, body: t(`${k}.body`, params), icon: "offer_response" };
    }
    case "new_message": {
      const preview = str(p, "preview");
      const params = { sender_name: str(p, "sender_name"), preview };
      return { title: t(`${k}.title`, params), body: preview ? t(`${k}.body`, params) : t(`${k}.body_attachment`, params), icon: "message" };
    }
    case "vacancy_expiring": {
      const params = { vacancy_title: str(p, "vacancy_title"), expires_at: dayText(str(p, "expires_at"), locale) };
      return { title: t(`${k}.title`, params), body: t(`${k}.body`, params), icon: "expiring" };
    }
    case "new_matching_vacancy": {
      const score = num(p, "score");
      const params = { vacancy_title: str(p, "vacancy_title"), score };
      return { title: t(`${k}.title`, params), body: score !== null ? t(`${k}.body`, params) : t(`${k}.body_noscore`, params), icon: "match_vacancy" };
    }
    case "new_matching_worker": {
      const score = num(p, "score");
      const params = { vacancy_title: str(p, "vacancy_title"), worker_name: str(p, "worker_name"), score };
      return { title: t(`${k}.title`, params), body: score !== null ? t(`${k}.body`, params) : t(`${k}.body_noscore`, params), icon: "match_worker" };
    }
    case "verification_result": {
      const status = str(p, "status");
      const note = str(p, "note");
      const params = { type: tEnum(t, "verification_type", str(p, "type")), note, status: tEnum(t, "verification_status", status) };
      const title = status === "verified" ? t(`${k}.title_verified`, params) : status === "rejected" ? t(`${k}.title_rejected`, params) : t(`${k}.title`, params);
      return { title, body: note ? t(`${k}.body_note`, params) : t(`${k}.body`, params), icon: "verification" };
    }
    case "review_received": {
      const params = { rating: num(p, "rating") ?? "" };
      return { title: t(`${k}.title`, params), body: t(`${k}.body`, params), icon: "review" };
    }
    case "system":
      if (str(p, "kind") === "payment_success") {
        return { title: t("billing.return.paid"), body: t(str(p, "purpose") === "vacancy_publish" ? "billing.return.paid_vacancy" : "billing.return.paid_promotion"), icon: "system" };
      }
    // falls through
    default: {
      const title = str(p, "title") || t("notifications.types.system.title");
      return { title, body: str(p, "body"), icon: "system" };
    }
  }
}
