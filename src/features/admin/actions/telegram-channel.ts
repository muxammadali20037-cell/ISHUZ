"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/auth/actions";
import { channelChatId, postToChannel } from "@/features/telegram-channel/channel";
import { CAPTION_LIMIT, CHANNEL_MEDIA_IDS, TEXT_LIMIT, telegramLength } from "@/features/telegram-channel/media";
import { logAdmin, requirePerm } from "./guard";

const schema = z
  .object({
    text: z.string().max(TEXT_LIMIT),
    mediaId: z.enum(CHANNEL_MEDIA_IDS).nullable(),
    pin: z.boolean(),
  })
  .refine((v) => (v.mediaId ? telegramLength(v.text.trim()) <= CAPTION_LIMIT : telegramLength(v.text.trim()) >= 1), { message: "text" });

/**
 * Rasmiy kanalga post (bot orqali). Ruxsat — ommaviy bildirishnoma bilan bir xil (notifications.broadcast).
 * Har yuborish audit jurnaliga yoziladi (matn uzunligi, media, xabar raqami).
 */
export async function sendChannelPost(input: unknown): Promise<ActionResult<{ link: string | null; pinned: boolean }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("notifications.broadcast");
  if (!guard.ok) return guard;
  const res = await postToChannel(parsed.data);
  if (!res.ok) return { ok: false, error: res.error === "telegram_failed" ? "channel_post_failed" : res.error };
  const supabase = await createClient();
  await logAdmin(supabase, "telegram.channel_post", "telegram_channel", channelChatId(), null, {
    media: parsed.data.mediaId,
    message_id: res.messageId,
    pinned: res.pinned,
    length: parsed.data.text.trim().length,
  });
  return { ok: true, data: { link: res.link, pinned: res.pinned } };
}
