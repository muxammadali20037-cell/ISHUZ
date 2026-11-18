"use server";

import { getServerEnv } from "@/lib/env";
import { socialHandle } from "@/lib/social";
import { getSession } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { allowRate } from "@/lib/rate-limit";
import { isChannelMember } from "./channel";

export interface ChannelPromptInfo {
  href: string;
  handle: string | null;
}

/**
 * Ilovaga kirganda "Telegram kanalimizga qo'shiling" oynasi kerakmi (ega, 2026-11-18: "har kirganda ilovaga Telegram kanalga
 * ulanish tugmasi chiqsin"). Kanal havolasi sozlanmagan bo'lsa — yo'q. Telegram orqali kirgan foydalanuvchi kanalda bo'lsa
 * (bot getChatMember) — yo'q: obunachini qayta-qayta bezovta qilmaymiz. Aniqlab bo'lmasa — ko'rsatiladi.
 * Qaytadi faqat ochiq havola va @nomi — foydalanuvchi ma'lumoti emas.
 */
export async function channelPromptInfo(): Promise<ChannelPromptInfo | null> {
  const href = getServerEnv().SOCIAL_TELEGRAM_URL;
  if (!href?.startsWith("https://")) return null;
  const session = await getSession().catch(() => null);
  if (session) {
    const supabase = await createClient();
    const { data } = await supabase.from("telegram_accounts").select("telegram_user_id").eq("profile_id", session.userId).maybeSingle();
    // Telegram so'rovi — foydalanuvchiga soatiga 20 tagacha (oyna har kirishda bir marta so'raydi; ortig'i — tekshiruvsiz)
    if (data?.telegram_user_id && (await allowRate(`channel_member:${session.userId}`, 20, 3600)) && (await isChannelMember(Number(data.telegram_user_id))) === true) {
      return null;
    }
  }
  return { href, handle: socialHandle(href) };
}
