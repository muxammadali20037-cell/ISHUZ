import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { processModerationQueue } from "@/features/moderation/service";
import { sweepPublishedContent } from "@/features/moderation/sweep";
import { cleanupRawVacancyPhotos } from "@/features/post/photo-finalize";
import { cleanupRawMedia } from "@/features/media/finalize";
import { runChannelAutopost } from "@/features/telegram-channel/autopost";
import { dispatchTelegramNotifications, type DispatchCounts } from "./telegram-dispatch";

export interface TickResult {
  moderated: number;
  /** kuchaytirilgan qoidalar bilan qayta tekshirilgan eski e'lonlar (moderation/sweep.ts) */
  swept: number;
  matchJobs: number;
  telegram: DispatchCounts | null;
  photosRemoved: number;
  /** Telegram kanalga avtomatik yuborilgan vakansiya/ishchi e'lonlari (telegram-channel/autopost.ts) */
  channelPosted: number;
}

const PHOTO_CLEANUP_EVERY_MS = 60 * 60_000;
let lastPhotoCleanup = 0;

/**
 * Fon ishlari bir joyda: moderatsiya navbati → moslik hodisalari (nashr / muhim yangilanish) → Telegram outbox
 * → (soatiga ko'pi bilan 1 marta, har bir server nusxasida) tashlab ketilgan rasmlarni (ish joyi, profil, logotip) tozalash.
 * E'lon joylash ekrani buni kutmaydi (after() yoki cron chaqiradi). Har bosqich xatosi keyingisini to'xtatmaydi.
 */
export async function runBackgroundTick(opts: { moderation?: number; matchJobs?: number; telegram?: number; budgetMs?: number } = {}): Promise<TickResult> {
  const started = Date.now();
  const budget = opts.budgetMs ?? 50_000;
  const admin = createAdminClient();
  const result: TickResult = { moderated: 0, swept: 0, matchJobs: 0, telegram: null, photosRemoved: 0, channelPosted: 0 };
  try {
    result.moderated = await processModerationQueue(opts.moderation ?? 8, Math.min(25_000, budget / 2));
  } catch (e) {
    console.error("[tick] moderation", e instanceof Error ? e.message : e);
  }
  try {
    // joylangan e'lonlarni kuchaytirilgan qoidalar bilan bir marta qayta tekshirish (kichik bo'laklarda; tugagach — bo'sh)
    result.swept = (await sweepPublishedContent(100, Math.min(8_000, budget / 5))).checked;
  } catch (e) {
    console.error("[tick] rules sweep", e instanceof Error ? e.message : e);
  }
  // moslik navbati (process_match_jobs) ishga tushirilmaydi — moslik o'chirilgan (ega, 2026-11-22; features/matching/off.ts)
  try {
    const left = Math.max(5_000, budget - (Date.now() - started));
    result.telegram = await dispatchTelegramNotifications(admin, { limit: opts.telegram ?? 200, budgetMs: left });
  } catch (e) {
    console.error("[tick] telegram", e instanceof Error ? e.message : e);
  }
  if (Date.now() - started < budget) {
    // yangi tasdiqlangan e'lonlar kanalga ("ISH" / "ISHCHI"); o'zi xato otmaydi
    result.channelPosted = (await runChannelAutopost()).posted;
  }
  if (Date.now() - lastPhotoCleanup > PHOTO_CLEANUP_EVERY_MS && Date.now() - started < budget) {
    lastPhotoCleanup = Date.now();
    try {
      // ish joyi surati + profil rasmi / logotip karantini (0058, 0059)
      result.photosRemoved = (await cleanupRawVacancyPhotos(100)) + (await cleanupRawMedia(100));
    } catch (e) {
      console.error("[tick] photo cleanup", e instanceof Error ? e.message : e);
    }
  }
  return result;
}

/** Server action'lardan keyin (after()): faqat service kaliti bo'lsa */
export async function runBackgroundTickSafe(opts?: Parameters<typeof runBackgroundTick>[0]) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  await runBackgroundTick(opts).catch((e) => console.error("[tick]", e instanceof Error ? e.message : e));
}
