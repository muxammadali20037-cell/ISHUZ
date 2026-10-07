import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import { answerCallback, editBotMessage, escapeHtml, sendTelegramMessage } from "@/lib/telegram/bot";
import type { TFunction } from "@/lib/i18n/translate";
import { WEB_LOGIN_CALLBACK_PREFIX, WEB_LOGIN_START_PREFIX, describeUserAgent, hashWebLoginToken, isWebLoginToken } from "./web-login";

type AdminClient = ReturnType<typeof createAdminClient>;
interface From {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

/** /start wl_<token>: so'rovni shu Telegram foydalanuvchisiga biriktiradi va "Tasdiqlaysizmi?" tugmasini yuboradi */
export async function handleWebLoginStart(admin: AdminClient, t: TFunction, chatId: number, from: From, param: string): Promise<void> {
  const token = param.slice(WEB_LOGIN_START_PREFIX.length);
  const tt = (k: string, p?: Record<string, string>) => escapeHtml(t(`auth.web_login.${k}`, p));
  if (!isWebLoginToken(token)) {
    await sendTelegramMessage(chatId, tt("expired"));
    return;
  }
  const { data: row } = await admin
    .from("web_login_requests")
    .select("id, expires_at, confirmed_at, consumed_at, telegram_user_id, user_agent")
    .eq("token_hash", hashWebLoginToken(token))
    .maybeSingle();
  const alive = row && !row.consumed_at && !row.confirmed_at && new Date(row.expires_at).getTime() > Date.now();
  // Boshqa Telegram hisobi allaqachon olgan so'rovni egallab bo'lmaydi
  if (!row || !alive || (row.telegram_user_id && row.telegram_user_id !== from.id)) {
    await sendTelegramMessage(chatId, tt("expired"));
    return;
  }
  await admin
    .from("web_login_requests")
    .update({ telegram_user_id: from.id, tg_user: { id: from.id, first_name: from.first_name, last_name: from.last_name, username: from.username, language_code: from.language_code } })
    .eq("id", row.id);
  await sendTelegramMessage(chatId, `${tt("confirm_title")}\n\n${tt("confirm_device", { device: describeUserAgent(row.user_agent) })}\n\n${tt("confirm_warning")}`, {
    inline_keyboard: [[{ text: t("auth.web_login.confirm_button"), callback_data: `${WEB_LOGIN_CALLBACK_PREFIX}${row.id}` }]],
  });
}

/** "✅ Ha, kirish" bosildi: faqat shu so'rovni boshlagan Telegram foydalanuvchisi tasdiqlay oladi */
export async function handleWebLoginConfirm(admin: AdminClient, t: TFunction, callbackId: string, chatId: number, messageId: number | null, fromId: number, data: string): Promise<void> {
  const id = data.slice(WEB_LOGIN_CALLBACK_PREFIX.length);
  const ok = /^[0-9a-f-]{36}$/.test(id)
    ? (
        await admin
          .from("web_login_requests")
          .update({ confirmed_at: new Date().toISOString() })
          .eq("id", id)
          .eq("telegram_user_id", fromId)
          .is("confirmed_at", null)
          .is("consumed_at", null)
          .gt("expires_at", new Date().toISOString())
          .select("id")
          .maybeSingle()
      ).data
    : null;
  const text = escapeHtml(t(ok ? "auth.web_login.confirmed" : "auth.web_login.expired"));
  await answerCallback(callbackId, ok ? t("auth.web_login.confirmed_short") : undefined);
  if (messageId) await editBotMessage(chatId, messageId, text);
  else await sendTelegramMessage(chatId, text);
}
