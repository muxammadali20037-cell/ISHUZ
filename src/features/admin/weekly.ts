import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { TASHKENT_TZ } from "@/lib/format";

/**
 * Haftalik raqamlar (birinchi daromad yo'l xaritasi, 8-bo'lim: "Nimani o'lchaymiz"). Sof modul — hafta chegaralari va
 * hisob-kitob; bazadan o'qish — weekly.server.ts. Hafta — dushanba 00:00 dan dushanba 00:00 gacha, Toshkent vaqti.
 */
export interface WeeklyKpis {
  /** yangi ish beruvchilar (profil yaratilgan) */
  employers: number;
  /** yangi haqiqiy vakansiyalar (joylangan; namuna e'lonlar — alohida jadvalda, kirmaydi) */
  vacancies: number;
  /** yangi arizalar */
  applications: number;
  /** hozir faol vakansiyalar (bir vakansiyaga arizalar uchun maxraj) */
  activeVacancies: number;
  /** noyob tashrifchilar (kirgan yoki anonim identifikator bo'yicha) */
  visitors: number;
  /** tashrifchilar soni chegaraga yetdi (haqiqiysi undan ko'p) */
  visitorsCapped?: boolean;
  /** TOP (Tezkor/Maksimal) sotib olgan ish beruvchilar */
  topBuyers: number;
  /** shu hafta to'lagan va umuman 2+ marta to'lagan */
  repeatBuyers: number;
  /** sof tushum, so'm (Payme/Click; hamyondan to'lov — ichki, kirmaydi; qaytarilgani ayrilgan) */
  revenue: number;
}

export interface WeekRange {
  /** UTC ISO */
  from: string;
  to: string;
  /** Toshkent kunlari, ko'rsatish uchun: dushanba va yakshanba (yyyy-MM-dd) */
  firstDay: string;
  lastDay: string;
}

const DAY = 86_400_000;

/** Hafta (dushanba–yakshanba, Toshkent) — `weeksAgo` = 1: oxirgi tugagan hafta, 0: joriy hafta */
export function weekRange(now: Date, weeksAgo = 1): WeekRange {
  const today = formatInTimeZone(now, TASHKENT_TZ, "yyyy-MM-dd");
  const isoDow = Number(formatInTimeZone(now, TASHKENT_TZ, "i")); // 1 = dushanba
  const monday = fromZonedTime(`${today}T00:00:00`, TASHKENT_TZ).getTime() - (isoDow - 1) * DAY - weeksAgo * 7 * DAY;
  const from = new Date(monday);
  const to = new Date(monday + 7 * DAY);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    firstDay: formatInTimeZone(from, TASHKENT_TZ, "yyyy-MM-dd"),
    lastDay: formatInTimeZone(new Date(to.getTime() - DAY), TASHKENT_TZ, "yyyy-MM-dd"),
  };
}

/** Bir vakansiyaga arizalar — bir xona aniqlikda (faol vakansiya bo'lmasa — 0) */
export function perVacancy(k: Pick<WeeklyKpis, "applications" | "activeVacancies">): number {
  return k.activeVacancies > 0 ? Math.round((k.applications / k.activeVacancies) * 10) / 10 : 0;
}

/** Hisobot yuboriladigan payt: dushanba, 09:00 dan keyin (Toshkent) */
export function isReportTime(now: Date): boolean {
  return formatInTimeZone(now, TASHKENT_TZ, "i") === "1" && Number(formatInTimeZone(now, TASHKENT_TZ, "H")) >= 9;
}

/** Takror yubormaslik kaliti: admin + hafta */
export function weeklyDedupeKey(profileId: string, range: WeekRange): string {
  return `weekly:${profileId}:${range.firstDay}`;
}

export interface PaidRow {
  profile_id: string | null;
  amount: number;
  plan: string | null;
  provider: string | null;
  status: string;
  paid_at: string | null;
  cancelled_at: string | null;
}

/** To'lovlardan: TOP oluvchilar, qayta oluvchilar, sof tushum. `allPaidCounts` — profil bo'yicha umumiy to'langanlar soni */
export function paymentKpis(rows: PaidRow[], range: WeekRange, allPaidCounts: Map<string, number>): Pick<WeeklyKpis, "topBuyers" | "repeatBuyers" | "revenue"> {
  const inRange = (iso: string | null) => !!iso && iso >= range.from && iso < range.to;
  const paidNow = rows.filter((r) => (r.status === "paid" || (r.status === "cancelled" && r.cancelled_at)) && inRange(r.paid_at));
  const top = new Set(paidNow.filter((r) => r.plan === "boost" || r.plan === "max").map((r) => r.profile_id).filter((p): p is string => !!p));
  const payers = new Set(paidNow.map((r) => r.profile_id).filter((p): p is string => !!p));
  const repeat = [...payers].filter((p) => (allPaidCounts.get(p) ?? 0) >= 2).length;
  const gross = paidNow.filter((r) => r.provider !== "wallet").reduce((s, r) => s + r.amount, 0);
  const refunds = rows.filter((r) => r.status === "cancelled" && r.paid_at && r.provider !== "wallet" && inRange(r.cancelled_at)).reduce((s, r) => s + r.amount, 0);
  return { topBuyers: top.size, repeatBuyers: repeat, revenue: gross - refunds };
}

/** Noyob tashrifchi: kirgan bo'lsa profil, aks holda anonim identifikator */
export function distinctVisitors(rows: { profile_id: string | null; anon_id: string | null }[]): number {
  return new Set(rows.map((r) => r.profile_id ?? (r.anon_id ? `a:${r.anon_id}` : null)).filter(Boolean)).size;
}
