import { formatInTimeZone } from "date-fns-tz";
import { TASHKENT_TZ } from "@/lib/format";

/**
 * Kunlik daromad hisoboti (admin, "To'lovlar"; birinchi daromad yo'l xaritasi, 3-bosqich). Sof modul — testlanadi.
 *
 *  - Tushum — Payme/Click orqali kelgan pul (to'langan kuni, Toshkent vaqti). Hamyondan to'lov — ichki harakat: pul
 *    to'ldirishda allaqachon kelgan, ikki marta sanalmaydi.
 *  - Qaytarilgan to'lov (to'langan, keyin bekor qilingan — Payme "cancel" 2-holat) — qaytarilgan kuni ayriladi.
 *  - Sof tushum = tushum − qaytarilgan.
 */
export interface RevenuePayment {
  amount: number;
  purpose: string;
  provider: string | null;
  status: string;
  paid_at: string | null;
  cancelled_at: string | null;
}

export interface RevenueDay {
  day: string;
  revenue: number;
  count: number;
  refunds: number;
  byPurpose: Record<string, number>;
}

export interface RevenueReport {
  days: RevenueDay[];
  totals: { revenue: number; refunds: number; net: number; count: number; average: number; today: number };
  byPurpose: { purpose: string; amount: number; count: number }[];
  byProvider: { provider: string; amount: number; count: number }[];
}

const dayKey = (iso: string) => formatInTimeZone(new Date(iso), TASHKENT_TZ, "yyyy-MM-dd");

/** Oxirgi `n` kun (bugun bilan), Toshkent vaqti bo'yicha, eskidan yangiga */
export function lastDays(n: number, now: Date): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(formatInTimeZone(new Date(now.getTime() - i * 86_400_000), TASHKENT_TZ, "yyyy-MM-dd"));
  return out;
}

/** Hisobot uchun so'rov chegarasi: oraliqning birinchi kuni boshlanishidan biroz oldin (vaqt mintaqasi zaxirasi bilan) */
export function revenueSince(n: number, now: Date): string {
  return new Date(now.getTime() - (n + 1) * 86_400_000).toISOString();
}

export function revenueReport(rows: RevenuePayment[], n: number, now: Date): RevenueReport {
  const keys = lastDays(n, now);
  const byDay = new Map<string, RevenueDay>(keys.map((day) => [day, { day, revenue: 0, count: 0, refunds: 0, byPurpose: {} }]));
  const purposes = new Map<string, { amount: number; count: number }>();
  const providers = new Map<string, { amount: number; count: number }>();

  for (const r of rows) {
    if (r.provider === "wallet" || !r.paid_at || !(r.amount > 0)) continue;
    const refunded = r.status === "cancelled" && !!r.cancelled_at;
    if (r.status !== "paid" && !refunded) continue;
    const paidDay = byDay.get(dayKey(r.paid_at));
    if (paidDay) {
      paidDay.revenue += r.amount;
      paidDay.count += 1;
      paidDay.byPurpose[r.purpose] = (paidDay.byPurpose[r.purpose] ?? 0) + r.amount;
      const p = purposes.get(r.purpose) ?? { amount: 0, count: 0 };
      purposes.set(r.purpose, { amount: p.amount + r.amount, count: p.count + 1 });
      const key = r.provider ?? "—";
      const v = providers.get(key) ?? { amount: 0, count: 0 };
      providers.set(key, { amount: v.amount + r.amount, count: v.count + 1 });
    }
    if (refunded) {
      const refundDay = byDay.get(dayKey(r.cancelled_at!));
      if (refundDay) refundDay.refunds += r.amount;
    }
  }

  const days = [...byDay.values()];
  const revenue = days.reduce((s, d) => s + d.revenue, 0);
  const refunds = days.reduce((s, d) => s + d.refunds, 0);
  const count = days.reduce((s, d) => s + d.count, 0);
  const today = byDay.get(keys[keys.length - 1]!)!;
  const sorted = (m: Map<string, { amount: number; count: number }>) => [...m.entries()].map(([k, v]) => ({ k, ...v })).sort((a, b) => b.amount - a.amount);
  return {
    days,
    totals: { revenue, refunds, net: revenue - refunds, count, average: count ? Math.round(revenue / count) : 0, today: today.revenue - today.refunds },
    byPurpose: sorted(purposes).map(({ k, amount, count: c }) => ({ purpose: k, amount, count: c })),
    byProvider: sorted(providers).map(({ k, amount, count: c }) => ({ provider: k, amount, count: c })),
  };
}
