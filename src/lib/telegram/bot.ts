import "server-only";

import { getServerEnv } from "@/lib/env";

type InlineKeyboard = { inline_keyboard: { text: string; url?: string; web_app?: { url: string } }[][] };
type ReplyKeyboard = { keyboard: { text: string; request_contact?: boolean }[][]; resize_keyboard?: boolean; one_time_keyboard?: boolean; is_persistent?: boolean };
type RemoveKeyboard = { remove_keyboard: true };
export type ReplyMarkup = InlineKeyboard | ReplyKeyboard | RemoveKeyboard;

/** Telegram Bot API ga so'rov (faqat server) */
async function callBot<T = unknown>(method: string, payload: Record<string, unknown>): Promise<T | null> {
  const { TELEGRAM_BOT_TOKEN } = getServerEnv();
  if (!TELEGRAM_BOT_TOKEN) return null;
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as { ok: boolean; result?: T; description?: string } | null;
  if (!data?.ok) {
    console.warn(`[telegram] ${method}: ${data?.description ?? res.status}`);
    return null;
  }
  return data.result ?? null;
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

export function openAppKeyboard(text: string, path = "/"): InlineKeyboard {
  const { APP_URL } = getServerEnv();
  return { inline_keyboard: [[{ text, web_app: { url: `${APP_URL}${path}` } }]] };
}

export async function sendTelegramMessage(chatId: number, html: string, keyboard?: ReplyMarkup) {
  return callBot("sendMessage", { chat_id: chatId, text: html, parse_mode: "HTML", reply_markup: keyboard, disable_web_page_preview: true });
}

/** "📱 Raqamni yuborish" — Telegram foydalanuvchining o'z raqamini ulashadi (request_contact) */
export function shareContactKeyboard(text: string): ReplyKeyboard {
  return { keyboard: [[{ text, request_contact: true }]], resize_keyboard: true, one_time_keyboard: true };
}

export const removeKeyboard: RemoveKeyboard = { remove_keyboard: true };

export async function setBotMenuButton() {
  const { APP_URL } = getServerEnv();
  return callBot("setChatMenuButton", { menu_button: { type: "web_app", text: "Worklyn", web_app: { url: APP_URL } } });
}

export async function setBotWebhook(url: string, secret: string) {
  return callBot("setWebhook", { url, secret_token: secret, allowed_updates: ["message"] });
}
