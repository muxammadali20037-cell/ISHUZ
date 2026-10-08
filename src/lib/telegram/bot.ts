import "server-only";

import { getServerEnv } from "@/lib/env";

export type InlineButton = { text: string; url?: string; web_app?: { url: string }; callback_data?: string };
export type InlineKeyboard = { inline_keyboard: InlineButton[][] };
export type ReplyKeyboard = { keyboard: { text: string; request_contact?: boolean }[][]; resize_keyboard?: boolean; one_time_keyboard?: boolean; is_persistent?: boolean; input_field_placeholder?: string };
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
  return { inline_keyboard: [[{ text, web_app: { url: `${miniAppBaseUrl()}${path}` } }]] };
}

export async function sendTelegramMessage(chatId: number, html: string, keyboard?: ReplyMarkup) {
  return callBot("sendMessage", { chat_id: chatId, text: html, parse_mode: "HTML", reply_markup: keyboard, disable_web_page_preview: true });
}

/** "📱 Raqamni yuborish" — Telegram foydalanuvchining o'z raqamini ulashadi (request_contact) */
export function shareContactKeyboard(text: string): ReplyKeyboard {
  return { keyboard: [[{ text, request_contact: true }]], resize_keyboard: true, one_time_keyboard: true };
}

export const removeKeyboard: RemoveKeyboard = { remove_keyboard: true };

/**
 * Mini App ochiladigan doimiy manzil. APP_URL bitta deployga bog'langan Vercel manzili bo'lsa
 * (masalan `ishuz-33oillnat-team.vercel.app`) — u hech qachon yangilanmaydi, shuning uchun loyihaning
 * doimiy production domeni (VERCEL_PROJECT_PRODUCTION_URL) olinadi. O'z domeningiz bo'lsa — APP_URL o'zgarmaydi.
 */
export function miniAppBaseUrl(): string {
  const appUrl = getServerEnv().APP_URL.replace(/\/$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!prod) return appUrl;
  try {
    const host = new URL(appUrl).host;
    if (host.endsWith(".vercel.app") && host !== prod) return `https://${prod}`;
  } catch {
    /* noto'g'ri APP_URL — production domeni */
    return `https://${prod}`;
  }
  return appUrl;
}

let menuSyncedAt = 0;
/** Har deploydan keyin menyu tugmasini avtomatik joriy manzilga ulaydi (instansiyada soatiga bir marta, xatolar e'tiborsiz). */
export async function syncBotMenuButtonOnce() {
  if (Date.now() - menuSyncedAt < 60 * 60 * 1000) return;
  menuSyncedAt = Date.now();
  await setBotMenuButton().catch(() => null);
}

export async function setBotMenuButton() {
  return callBot("setChatMenuButton", { menu_button: { type: "web_app", text: "Ish topdim", web_app: { url: miniAppBaseUrl() } } });
}

export async function setBotWebhook(url: string, secret: string) {
  return callBot("setWebhook", { url, secret_token: secret, allowed_updates: ["message", "callback_query"] });
}

/** Bot menyusidagi buyruqlar (chap pastdagi "/" ro'yxati) */
export async function setBotCommands(commands: { command: string; description: string }[], languageCode?: string) {
  return callBot("setMyCommands", { commands, ...(languageCode ? { language_code: languageCode } : {}) });
}

export function webAppUrl(path = "/") {
  return `${miniAppBaseUrl()}${path}`;
}

/** Xabar yuboradi va message_id qaytaradi (keyin tahrirlash uchun) */
export async function sendBotMessage(chatId: number, html: string, keyboard?: ReplyMarkup): Promise<number | null> {
  const res = await callBot<{ message_id: number }>("sendMessage", { chat_id: chatId, text: html, parse_mode: "HTML", reply_markup: keyboard, disable_web_page_preview: true });
  return res?.message_id ?? null;
}

export async function editBotMessage(chatId: number, messageId: number, html: string, keyboard?: InlineKeyboard) {
  return callBot("editMessageText", { chat_id: chatId, message_id: messageId, text: html, parse_mode: "HTML", reply_markup: keyboard, disable_web_page_preview: true });
}

export async function editBotKeyboard(chatId: number, messageId: number, keyboard: InlineKeyboard) {
  return callBot("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: keyboard });
}

export async function answerCallback(callbackId: string, text?: string) {
  return callBot("answerCallbackQuery", { callback_query_id: callbackId, ...(text ? { text } : {}) });
}

export async function sendChatAction(chatId: number, action: "typing" | "upload_document") {
  return callBot("sendChatAction", { chat_id: chatId, action });
}

/** Fayl (PDF) yuborish — multipart/form-data */
export async function sendBotDocument(chatId: number, file: Uint8Array, fileName: string, captionHtml?: string, keyboard?: ReplyMarkup): Promise<boolean> {
  const { TELEGRAM_BOT_TOKEN } = getServerEnv();
  if (!TELEGRAM_BOT_TOKEN) return false;
  const form = new FormData();
  form.set("chat_id", String(chatId));
  form.set("document", new Blob([new Uint8Array(file)], { type: "application/pdf" }), fileName);
  if (captionHtml) {
    form.set("caption", captionHtml);
    form.set("parse_mode", "HTML");
  }
  if (keyboard) form.set("reply_markup", JSON.stringify(keyboard));
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, { method: "POST", body: form, cache: "no-store" });
  const data = (await res.json().catch(() => null)) as { ok: boolean; description?: string } | null;
  if (!data?.ok) console.warn(`[telegram] sendDocument: ${data?.description ?? res.status}`);
  return !!data?.ok;
}
