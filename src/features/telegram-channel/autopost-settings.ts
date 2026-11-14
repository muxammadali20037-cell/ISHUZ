import { channelChatIdFrom } from "./media";

/**
 * Telegram kanalga avtomatik e'lon sozlamasi (app_settings.channel_autopost; admin → "Telegram kanal").
 * Standart (sozlama yo'q): ikkalasi yoqilgan, ikkalasi ham asosiy kanalga (TELEGRAM_CHANNEL_ID / SOCIAL_TELEGRAM_URL).
 * Alohida kanal berilsa — vakansiyalar ("ISH") ish izlovchilar kanaliga, ishchi e'lonlari ("ISHCHI") ish beruvchilar kanaliga.
 */
export const AUTOPOST_KEY = "channel_autopost";

export interface AutopostSettings {
  jobs: boolean;
  workers: boolean;
  /** @username, t.me havola yoki -100… id; null — asosiy kanal */
  jobsChat: string | null;
  workersChat: string | null;
}

export const AUTOPOST_DEFAULT: AutopostSettings = { jobs: true, workers: true, jobsChat: null, workersChat: null };

export function parseAutopost(value: unknown): AutopostSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return AUTOPOST_DEFAULT;
  const v = value as Record<string, unknown>;
  const chat = (x: unknown) => (typeof x === "string" && channelChatIdFrom(x) ? channelChatIdFrom(x) : null);
  return {
    jobs: typeof v.jobs === "boolean" ? v.jobs : true,
    workers: typeof v.workers === "boolean" ? v.workers : true,
    jobsChat: chat(v.jobsChat),
    workersChat: chat(v.workersChat),
  };
}
