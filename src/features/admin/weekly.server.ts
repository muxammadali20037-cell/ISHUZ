import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { distinctVisitors, isReportTime, paymentKpis, weekRange, weeklyDedupeKey, type PaidRow, type WeekRange, type WeeklyKpis } from "./weekly";

type Admin = ReturnType<typeof createAdminClient>;

/** PostgREST bir so'rovda ko'pi bilan 1000 qator beradi — sahifalab o'qiladi */
const PAGE = 1000;
/** Tashrifchilar uchun o'qiladigan hodisalar chegarasi (oshsa — "kamida" deb ko'rsatiladi) */
const VISITOR_ROWS = 50_000;

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Sahifalab o'qish: `page(from, to)` har safar yangi so'rov qaytaradi (barqaror tartib bilan). `capped` — chegaraga yetdi */
async function readAll<T>(name: string, page: (from: number, to: number) => Page<T>, cap: number): Promise<{ rows: T[]; capped: boolean }> {
  const rows: T[] = [];
  for (let from = 0; from < cap; from += PAGE) {
    const { data, error } = await page(from, Math.min(from + PAGE, cap) - 1);
    if (error) throw new Error(`${name}: ${error.message}`);
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) return { rows, capped: false };
  }
  return { rows, capped: true };
}

/** Hafta raqamlari — faqat sonlar (shaxsiy ma'lumot chiqmaydi). Service role bilan: cron va admin paneli (ruxsat tekshirilgach) */
export async function computeWeekly(admin: Admin, range: WeekRange): Promise<WeeklyKpis> {
  const head = async (name: string, q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const { count, error } = await q;
    if (error) throw new Error(`${name}: ${error.message}`);
    return count ?? 0;
  };
  const exact = { count: "exact" as const, head: true };
  const [employers, applications, vacancies, activeVacancies, events, paid] = await Promise.all([
    head("employer_profiles", admin.from("employer_profiles").select("id", exact).gte("created_at", range.from).lt("created_at", range.to)),
    head("applications", admin.from("applications").select("id", exact).gte("created_at", range.from).lt("created_at", range.to)),
    head("vacancies", admin.from("vacancies").select("id", exact).gte("published_at", range.from).lt("published_at", range.to)),
    head("active", admin.from("vacancies").select("id", exact).eq("status", "active")),
    readAll("analytics_events", (a, b) => admin.from("analytics_events").select("profile_id, anon_id").gte("created_at", range.from).lt("created_at", range.to).order("id").range(a, b), VISITOR_ROWS),
    readAll<PaidRow>(
      "payments",
      (a, b) =>
        admin
          .from("payments")
          .select("profile_id, amount, plan, provider, status, paid_at, cancelled_at")
          .not("paid_at", "is", null)
          .or(`and(paid_at.gte."${range.from}",paid_at.lt."${range.to}"),and(cancelled_at.gte."${range.from}",cancelled_at.lt."${range.to}")`)
          .order("id")
          .range(a, b),
      20_000,
    ),
  ]);
  const payers = [...new Set(paid.rows.map((r) => r.profile_id).filter((p): p is string => !!p))];
  const allPaid = new Map<string, number>();
  for (let i = 0; i < payers.length; i += 200) {
    const chunk = payers.slice(i, i + 200);
    const { rows } = await readAll("payments(all)", (a, b) => admin.from("payments").select("profile_id").eq("status", "paid").in("profile_id", chunk).order("id").range(a, b), 20_000);
    for (const r of rows) if (r.profile_id) allPaid.set(r.profile_id, (allPaid.get(r.profile_id) ?? 0) + 1);
  }
  return {
    employers,
    vacancies,
    applications,
    activeVacancies,
    visitors: distinctVisitors(events.rows),
    ...(events.capped ? { visitorsCapped: true } : {}),
    ...paymentKpis(paid.rows, range, allPaid),
  };
}

export interface WeeklyComparison {
  range: WeekRange;
  cur: WeeklyKpis;
  prev: WeeklyKpis;
}

/** Oxirgi tugagan hafta va undan oldingisi */
export async function lastTwoWeeks(admin: Admin, now = new Date()): Promise<WeeklyComparison> {
  const range = weekRange(now, 1);
  const [cur, prev] = await Promise.all([computeWeekly(admin, range), computeWeekly(admin, weekRange(now, 2))]);
  return { range, cur, prev };
}

/** Admin paneli uchun (sahifa analytics.view ruxsatini tekshirgandan keyin chaqiriladi). Xatoda — matn */
export async function getWeeklyComparison(): Promise<{ data: WeeklyComparison | null; error: string | null }> {
  try {
    return { data: await lastTwoWeeks(createAdminClient()), error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Dushanba 09:00 (Toshkent) dan keyin: har bir faol admin (super_admin, admin yoki analytics.view; bloklanmagan) ga bitta
 * "Haftalik raqamlar" bildirishnomasi — saytda va Telegram'da (bildirishnoma navbati orqali). Takrorlanmaydi
 * (dedupe_key: admin + hafta). Boshqa kunlarda hech narsa qilmaydi (`force` — qo'lda sinash uchun).
 */
export async function sendWeeklyReport(now = new Date(), opts: { force?: boolean } = {}): Promise<{ sent: number; skipped?: string }> {
  if (!opts.force && !isReportTime(now)) return { sent: 0, skipped: "not_report_time" };
  const admin = createAdminClient();
  const { data: admins, error } = await admin
    .from("admin_users")
    .select("profile_id, role, permissions, profiles!admin_users_profile_id_fkey!inner(is_blocked)")
    .eq("is_active", true)
    .eq("profiles.is_blocked", false);
  if (error) throw new Error(`admin_users: ${error.message}`);
  const to = (admins ?? []).filter((a) => a.role === "super_admin" || a.role === "admin" || (a.permissions ?? []).includes("analytics.view")).map((a) => a.profile_id);
  if (!to.length) return { sent: 0, skipped: "no_admins" };

  const range = weekRange(now, 1);
  const { data: existing, error: exErr } = await admin.from("notifications").select("dedupe_key").in("dedupe_key", to.map((p) => weeklyDedupeKey(p, range)));
  if (exErr) throw new Error(`notifications(existing): ${exErr.message}`);
  const done = new Set((existing ?? []).map((r) => r.dedupe_key));
  const pending = to.filter((p) => !done.has(weeklyDedupeKey(p, range)));
  if (!pending.length) return { sent: 0, skipped: "already_sent" };

  const { cur, prev } = await lastTwoWeeks(admin, now);
  const payload = { kind: "weekly_report", from: range.firstDay, to: range.lastDay, cur: { ...cur }, prev: { ...prev } };
  // dedupe indeksi qisman (where dedupe_key is not null) — upsert'ning on_conflict'i unga mos kelmaydi, shuning uchun
  // birma-bir qo'shiladi; parallel chaqiruvda takror kalit (23505) — allaqachon yuborilgan, xato emas
  let sent = 0;
  for (const p of pending) {
    const { error: insErr } = await admin.from("notifications").insert({ profile_id: p, type: "system", payload, link: "/admin", dedupe_key: weeklyDedupeKey(p, range) });
    if (!insErr) sent += 1;
    else if (insErr.code !== "23505") throw new Error(`notifications: ${insErr.message}`);
  }
  return { sent };
}
