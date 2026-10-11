import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { processModerationQueue } from "@/features/moderation/service";
import { cleanupRawVacancyPhotos } from "@/features/post/photo-finalize";
import { dispatchTelegramNotifications, type DispatchCounts } from "./telegram-dispatch";

export interface TickResult {
  moderated: number;
  matchJobs: number;
  telegram: DispatchCounts | null;
  photosRemoved: number;
}

const PHOTO_CLEANUP_EVERY_MS = 60 * 60_000;
let lastPhotoCleanup = 0;

/**
 * Fon ishlari bir joyda: moderatsiya navbati → moslik hodisalari (nashr / muhim yangilanish) → Telegram outbox
 * → (soatiga ko'pi bilan 1 marta, har bir server nusxasida) tashlab ketilgan ish joyi rasmlarini tozalash.
 * E'lon joylash ekrani buni kutmaydi (after() yoki cron chaqiradi). Har bosqich xatosi keyingisini to'xtatmaydi.
 */
export async function runBackgroundTick(opts: { moderation?: number; matchJobs?: number; telegram?: number; budgetMs?: number } = {}): Promise<TickResult> {
  const started = Date.now();
  const budget = opts.budgetMs ?? 50_000;
  const admin = createAdminClient();
  const result: TickResult = { moderated: 0, matchJobs: 0, telegram: null, photosRemoved: 0 };
  try {
    result.moderated = await processModerationQueue(opts.moderation ?? 8, Math.min(25_000, budget / 2));
  } catch (e) {
    console.error("[tick] moderation", e instanceof Error ? e.message : e);
  }
  try {
    const { data } = await admin.rpc("process_match_jobs", { p_limit: opts.matchJobs ?? 20 });
    result.matchJobs = data ?? 0;
  } catch (e) {
    console.error("[tick] match jobs", e instanceof Error ? e.message : e);
  }
  try {
    const left = Math.max(5_000, budget - (Date.now() - started));
    result.telegram = await dispatchTelegramNotifications(admin, { limit: opts.telegram ?? 200, budgetMs: left });
  } catch (e) {
    console.error("[tick] telegram", e instanceof Error ? e.message : e);
  }
  if (Date.now() - lastPhotoCleanup > PHOTO_CLEANUP_EVERY_MS && Date.now() - started < budget) {
    lastPhotoCleanup = Date.now();
    try {
      result.photosRemoved = await cleanupRawVacancyPhotos(100);
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
