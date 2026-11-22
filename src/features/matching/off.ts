/**
 * Moslik o'chirilgan (ega, 2026-11-22: "moslikni hamma joydan olib tashla, umuman kerak emas — ish qidiruvchilar uchun ham,
 * ish beruvchilar uchun ham"; "Sizga mos yangi ish chiqdi" / "Mos nomzod topildi" xabarlari ham — "ular ham o'chsin").
 *
 * Baza hali bunday bildirishnomalarni yaratadi (triggerlar: notify_matching_workers, AI xabarnomalar) — ular foydalanuvchiga
 * ko'rsatilmaydi va Telegram'ga yuborilmaydi: qo'ng'iroqcha ro'yxatidan chiqariladi, fon vazifasi ularni o'qilgan va
 * "yuborilmaydi" deb belgilaydi (qizil nuqta ham chiqmaydi). Moslik navbati (process_match_jobs) ishga tushirilmaydi.
 */
export const MATCH_NOTIFICATION_TYPES = ["new_matching_vacancy", "new_matching_worker"] as const;
export const MATCH_ALERT_KINDS = ["ai_alert", "ai_worker_alert"] as const;

export function isMatchNotification(row: { type: string; payload: unknown }): boolean {
  if ((MATCH_NOTIFICATION_TYPES as readonly string[]).includes(row.type)) return true;
  const kind = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? (row.payload as Record<string, unknown>).kind : null;
  return typeof kind === "string" && (MATCH_ALERT_KINDS as readonly string[]).includes(kind);
}

/** PostgREST filtrlari (qo'ng'iroqcha ro'yxati): moslik turlari va AI xabarnomalari chiqarib tashlanadi */
export const NOT_MATCH_TYPES = `(${MATCH_NOTIFICATION_TYPES.join(",")})`;
export const NOT_MATCH_KINDS_OR = `payload->>kind.is.null,payload->>kind.not.in.(${MATCH_ALERT_KINDS.join(",")})`;
