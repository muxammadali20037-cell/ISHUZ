/**
 * Toshkent vaqti (UTC+5, yozgi vaqt yo'q) bilan sana/vaqt maydonlari ↔ ISO.
 * Sof modul — vitest bilan testlanadi.
 */
const OFFSET_MIN = 5 * 60;

/** "2026-10-03" + "10:30" → "2026-10-03T10:30:00+05:00" */
export function tashkentToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const iso = `${date}T${time}:00+05:00`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/** ISO → { date: "2026-10-03", time: "10:30" } Toshkent vaqtida */
export function isoToTashkent(iso: string): { date: string; time: string } {
  const d = new Date(new Date(iso).getTime() + OFFSET_MIN * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` };
}

/** Bugungi sana Toshkentda (date input min uchun) */
export function tashkentToday(now: Date = new Date()): string {
  return isoToTashkent(now.toISOString()).date;
}
