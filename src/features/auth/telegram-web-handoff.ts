import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import { miniAppBaseUrl } from "@/lib/telegram/bot";
import { newSecret, sha256hex } from "./telegram-web-login";

/** Botdagi "Ochish" havolasi ochadigan manzil (bir martalik, ?r=<so'rov id>.<kalit>) */
export const HANDOFF_PATH = "/api/auth/telegram-web/open";
export const HANDOFF_PARAM = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/;

/**
 * "✅ Kirish" tasdiqlangach botdagi "Ochish" — Mini App emas, SAYT (ega, 2026-11-20: "Ochish bosilsa saytga olib borsin").
 * Havola qaysi brauzerda ochilmasin (Telegram ichidagi yoki telefon brauzeri) — o'sha brauzer ham kiradi: shu Telegram
 * foydalanuvchisi uchun yangi, allaqachon tasdiqlangan bir martalik so'rov (0085 jadvali, 5 daqiqa) yaratiladi; brauzer
 * kaliti cookie o'rniga havolaning o'zida. Havola faqat shu foydalanuvchining o'z bot chatiga yuboriladi; bir marta
 * ishlatiladi (consume atomik). Xato bo'lsa — null (bot eski "Ochish" Mini App tugmasini qo'yadi).
 */
export async function createSiteHandoff(admin: ReturnType<typeof createAdminClient>, telegramUserId: number, profileId: string, path = "/chat"): Promise<string | null> {
  const nonce = newSecret();
  const { data: id, error } = await admin.rpc("telegram_web_login_create", {
    p_token_hash: sha256hex(newSecret()),
    p_browser_hash: sha256hex(nonce),
    p_user_agent: "Telegram",
  });
  if (error || !id) return null;
  const { data: status } = await admin.rpc("telegram_web_login_confirm", { p_id: id, p_telegram_user_id: telegramUserId, p_profile_id: profileId });
  if (status !== "ok") return null;
  const q = new URLSearchParams({ r: `${id}.${nonce}`, to: path });
  return `${miniAppBaseUrl()}${HANDOFF_PATH}?${q.toString()}`;
}
