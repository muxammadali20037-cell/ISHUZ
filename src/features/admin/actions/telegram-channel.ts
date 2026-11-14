"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/auth/actions";
import { channelChatId, postToChannel } from "@/features/telegram-channel/channel";
import { CAPTION_LIMIT, CHANNEL_MEDIA_IDS, TEXT_LIMIT, channelChatIdFrom, telegramLength } from "@/features/telegram-channel/media";
import { AUTOPOST_KEY } from "@/features/telegram-channel/autopost-settings";
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

const autopostSchema = z.object({
  jobs: z.boolean(),
  workers: z.boolean(),
  jobsChat: z.string().trim().max(100).nullable(),
  workersChat: z.string().trim().max(100).nullable(),
});

/**
 * Kanalga avtomatik e'lon sozlamasi (app_settings.channel_autopost): vakansiyalar ("ISH") va ishchi e'lonlari ("ISHCHI")
 * alohida yoqiladi; xohlasa — har biri o'z kanaliga. Yozish — settings.manage (app_settings RLS), audit bilan.
 */
export async function saveChannelAutopost(input: unknown): Promise<ActionResult> {
  const parsed = autopostSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const chat = (v: string | null) => (v ? channelChatIdFrom(v) : null);
  if ((parsed.data.jobsChat && !chat(parsed.data.jobsChat)) || (parsed.data.workersChat && !chat(parsed.data.workersChat))) return { ok: false, error: "channel_invalid" };
  const guard = await requirePerm("settings.manage");
  if (!guard.ok) return guard;
  const value = { jobs: parsed.data.jobs, workers: parsed.data.workers, jobsChat: chat(parsed.data.jobsChat), workersChat: chat(parsed.data.workersChat) };
  const supabase = await createClient();
  const { data: before } = await supabase.from("app_settings").select("key, value").eq("key", AUTOPOST_KEY).maybeSingle();
  const { data, error } = before
    ? await supabase.from("app_settings").update({ value, is_public: false }).eq("key", AUTOPOST_KEY).select("key, value").maybeSingle()
    : await supabase.from("app_settings").insert({ key: AUTOPOST_KEY, value, is_public: false }).select("key, value").maybeSingle();
  if (error) return { ok: false, error: "generic" };
  if (!data) return { ok: false, error: "forbidden" };
  await logAdmin(supabase, "settings.update", "app_setting", AUTOPOST_KEY, before ? { value: before.value } : null, { value });
  revalidatePath("/admin/telegram");
  return { ok: true };
}
