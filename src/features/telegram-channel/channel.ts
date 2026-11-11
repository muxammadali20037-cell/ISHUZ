import "server-only";

import { getServerEnv, testOnlyOverride } from "@/lib/env";
import { escapeHtml, miniAppBaseUrl } from "@/lib/telegram/bot";
import { channelChatIdFrom, channelMedia, type ChannelMediaId } from "./media";

/**
 * Rasmiy Telegram kanalga bot orqali post (admin → "Telegram kanal").
 * Bot kanalda admin bo'lishi va "Xabar joylash" huquqiga ega bo'lishi kerak; qadash uchun — "Xabarlarni tahrirlash" ham.
 * Media — saytdagi ochiq fayllar (public/media/kanal): Telegram ularni production manzilidan URL bo'yicha oladi.
 */

type TgResult<T> = { ok: true; result: T } | { ok: false; code: number; description: string };

async function tg<T>(method: string, payload: Record<string, unknown>, timeoutMs = 15_000): Promise<TgResult<T>> {
  const { TELEGRAM_BOT_TOKEN } = getServerEnv();
  if (!TELEGRAM_BOT_TOKEN) return { ok: false, code: 0, description: "telegram_not_configured" };
  const base = (testOnlyOverride(process.env.TELEGRAM_API_BASE) ?? "https://api.telegram.org").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = (await res.json().catch(() => null)) as { ok: boolean; result?: T; error_code?: number; description?: string } | null;
    if (data?.ok) return { ok: true, result: data.result as T };
    const description = data?.description ?? `HTTP ${res.status}`;
    console.warn(`[telegram-channel] ${method}: ${description}`);
    return { ok: false, code: data?.error_code ?? res.status, description };
  } catch (e) {
    const name = e instanceof Error ? e.name : "network";
    console.warn(`[telegram-channel] ${method}: ${name}`);
    return { ok: false, code: 0, description: name === "TimeoutError" ? "timeout" : "network" };
  }
}

export function channelChatId(): string | null {
  const { TELEGRAM_CHANNEL_ID, SOCIAL_TELEGRAM_URL } = getServerEnv();
  return channelChatIdFrom(TELEGRAM_CHANNEL_ID) ?? channelChatIdFrom(SOCIAL_TELEGRAM_URL);
}

export type ChannelStatus =
  | { state: "no_token" | "no_channel" }
  | {
      state: "ready" | "not_admin" | "unreachable";
      chatId: string;
      title?: string;
      username?: string;
      botUsername?: string;
      canPost: boolean;
      canPin: boolean;
      error?: string;
    };

/** Kanal va botning holati: bot kanalda adminmi, post yubora oladimi, qadaydimi */
export async function channelStatus(): Promise<ChannelStatus> {
  if (!getServerEnv().TELEGRAM_BOT_TOKEN) return { state: "no_token" };
  const chatId = channelChatId();
  if (!chatId) return { state: "no_channel" };
  const me = await tg<{ id: number; username?: string }>("getMe", {});
  if (!me.ok) return { state: "unreachable", chatId, canPost: false, canPin: false, error: me.description };
  const [chat, member] = await Promise.all([
    tg<{ title?: string; username?: string }>("getChat", { chat_id: chatId }),
    tg<{ status: string; can_post_messages?: boolean; can_edit_messages?: boolean }>("getChatMember", { chat_id: chatId, user_id: me.result.id }),
  ]);
  const base = { chatId, botUsername: me.result.username, title: chat.ok ? chat.result.title : undefined, username: chat.ok ? chat.result.username : undefined };
  if (!chat.ok) return { ...base, state: "unreachable", canPost: false, canPin: false, error: chat.description };
  const isAdmin = member.ok && (member.result.status === "administrator" || member.result.status === "creator");
  const canPost = isAdmin && (member.result.status === "creator" || member.result.can_post_messages === true);
  const canPin = isAdmin && (member.result.status === "creator" || member.result.can_edit_messages === true);
  return { ...base, state: canPost ? "ready" : "not_admin", canPost, canPin };
}

export type ChannelPostResult = { ok: true; messageId: number; pinned: boolean; link: string | null } | { ok: false; error: string; description?: string };

/** Kanalga post: matn (oddiy matn — HTML sifatida xavfsizlanadi), ixtiyoriy tayyor media, ixtiyoriy qadash */
export async function postToChannel(input: { text: string; mediaId: ChannelMediaId | null; pin: boolean }): Promise<ChannelPostResult> {
  const chatId = channelChatId();
  if (!getServerEnv().TELEGRAM_BOT_TOKEN) return { ok: false, error: "telegram_not_configured" };
  if (!chatId) return { ok: false, error: "channel_not_configured" };
  const media = channelMedia(input.mediaId);
  if (media && media.files.length === 0) return { ok: false, error: "telegram_failed", description: "no media files" };
  const html = escapeHtml(input.text.trim());
  const abs = (p: string) => `${miniAppBaseUrl()}${p}`;

  let messageId: number | null = null;
  let fail: string | null = null;
  if (!media) {
    const r = await tg<{ message_id: number }>("sendMessage", { chat_id: chatId, text: html, parse_mode: "HTML", link_preview_options: { is_disabled: true } });
    if (r.ok) messageId = r.result.message_id;
    else fail = r.description;
  } else if (media.kind === "video") {
    // Telegram videoni o'zi yuklab oladi — kutish uzunroq
    const video = media.files[0] as string;
    const r = await tg<{ message_id: number }>(
      "sendVideo",
      { chat_id: chatId, video: abs(video), caption: html || undefined, parse_mode: "HTML", supports_streaming: true, width: media.width, height: media.height, duration: media.duration },
      55_000,
    );
    if (r.ok) messageId = r.result.message_id;
    else fail = r.description;
  } else {
    const items = media.files.map((f, i) => ({ type: "photo", media: abs(f), ...(i === 0 && html ? { caption: html, parse_mode: "HTML" } : {}) }));
    const r = await tg<{ message_id: number }[]>("sendMediaGroup", { chat_id: chatId, media: items }, 40_000);
    if (r.ok) messageId = r.result[0]?.message_id ?? null;
    else fail = r.description;
  }
  if (messageId === null) return { ok: false, error: "telegram_failed", description: fail ?? undefined };

  let pinned = false;
  if (input.pin) {
    const p = await tg<boolean>("pinChatMessage", { chat_id: chatId, message_id: messageId, disable_notification: true });
    pinned = p.ok;
  }
  const link = chatId.startsWith("@") ? `https://t.me/${chatId.slice(1)}/${messageId}` : null;
  return { ok: true, messageId, pinned, link };
}
