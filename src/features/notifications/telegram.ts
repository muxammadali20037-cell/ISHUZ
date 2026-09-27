/**
 * Telegram webhook uchun sof yordamchilar (kutubxonasiz, testlanadi):
 * update sxemasi, /start buyrug'ini ajratish, til tanlash.
 */
import { z } from "zod";
import type { Locale } from "@/lib/i18n/config";

export const telegramUserSchema = z
  .object({
    id: z.number().int(),
    is_bot: z.boolean().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    username: z.string().optional(),
    language_code: z.string().optional(),
  })
  .loose();

export const telegramMessageSchema = z
  .object({
    message_id: z.number().int(),
    text: z.string().optional(),
    from: telegramUserSchema.optional(),
    /** request_contact tugmasi orqali ulashilgan kontakt */
    contact: z.object({ phone_number: z.string(), user_id: z.number().int().optional() }).loose().optional(),
    chat: z.object({ id: z.number().int(), type: z.string() }).loose(),
  })
  .loose();

/** Bizga faqat `message` kerak; boshqa update turlari (edited_message, callback_query ...) e'tiborsiz qoladi */
export const telegramUpdateSchema = z
  .object({
    update_id: z.number().int(),
    message: telegramMessageSchema.optional(),
  })
  .loose();

export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;

export interface BotCommand {
  name: string;
  param: string | null;
}

/** "/start abc" | "/start@ishuz_bot abc" → {name: "start", param: "abc"}; oddiy matn → null */
export function parseBotCommand(text: string | undefined | null): BotCommand | null {
  if (!text) return null;
  const m = /^\/([a-zA-Z0-9_]{1,32})(?:@[a-zA-Z0-9_]{1,64})?(?:\s+(.{1,256}))?\s*$/s.exec(text.trim());
  if (!m) return null;
  const rawParam = m[2]?.trim() ?? "";
  // Telegram deep-link start param: faqat [A-Za-z0-9_-], 64 gacha
  const param = /^[A-Za-z0-9_-]{1,64}$/.test(rawParam) ? rawParam : null;
  return { name: (m[1] ?? "").toLowerCase(), param };
}

/** Til: profil tili → telegram_accounts.language_code → xabardagi from.language_code → uz */
export function resolveTelegramLocale(candidates: Array<string | null | undefined>): Locale {
  for (const c of candidates) {
    if (!c) continue;
    const code = c.toLowerCase();
    if (code === "ru" || code.startsWith("ru-")) return "ru";
    if (code === "uz" || code.startsWith("uz-")) return "uz";
  }
  return "uz";
}

/** Telegram API error tavsiflari orasidan "bot bloklangan / chat yo'q" holatini ajratadi */
export function isTelegramBlockedError(errorCode: number | undefined, description: string | undefined): boolean {
  if (errorCode === 403) return true;
  const d = (description ?? "").toLowerCase();
  return /bot was blocked|user is deactivated|chat not found|bot can't initiate/.test(d);
}
