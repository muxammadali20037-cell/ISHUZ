/**
 * Statistika davri Toshkent vaqtida (UTC+5, yozgi vaqt yo'q): Bugun / 7 kun / 30 kun / tanlangan oraliq.
 * Natija: [from, to) UTC vaqtlar; "to" — oraliq oxiridagi kundan keyingi Toshkent yarim tuni.
 */
export type PeriodKind = "today" | "7" | "30" | "custom";

const TZ_OFFSET_MS = 5 * 3600_000;
const DAY = 86_400_000;

function tashkentMidnight(utcMs: number): number {
  return Math.floor((utcMs + TZ_OFFSET_MS) / DAY) * DAY - TZ_OFFSET_MS;
}

function parseDay(s: string | undefined): number | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const ms = Date.parse(`${s}T00:00:00Z`);
  return Number.isFinite(ms) ? ms - TZ_OFFSET_MS : null;
}

export function toTashkentDay(utcMs: number): string {
  return new Date(utcMs + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

export interface Period {
  kind: PeriodKind;
  from: Date;
  to: Date;
  /** YYYY-MM-DD (Toshkent), "to" — shu kun ham kiradi */
  fromDay: string;
  toDay: string;
}

export function resolvePeriod(kind: string | undefined, fromStr?: string, toStr?: string, now = Date.now()): Period {
  const today = tashkentMidnight(now);
  let k: PeriodKind = kind === "today" || kind === "7" || kind === "custom" ? kind : "30";
  let from = k === "today" ? today : today - ((k === "7" ? 7 : 30) - 1) * DAY;
  let to = today + DAY;
  if (k === "custom") {
    const f = parseDay(fromStr);
    const t = parseDay(toStr);
    if (f !== null && t !== null && t >= f && t - f <= 366 * DAY) {
      from = f;
      to = t + DAY;
    } else {
      k = "30";
      from = today - 29 * DAY;
    }
  }
  return { kind: k, from: new Date(from), to: new Date(to), fromDay: toTashkentDay(from), toDay: toTashkentDay(to - DAY) };
}
