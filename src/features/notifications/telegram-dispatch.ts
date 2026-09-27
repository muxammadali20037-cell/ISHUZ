import "server-only";

import { getServerEnv } from "@/lib/env";
import { escapeHtml, openAppKeyboard, type ReplyMarkup } from "@/lib/telegram/bot";
import { makeT } from "@/lib/i18n/translate";
import type { createAdminClient } from "@/lib/supabase/admin";
import { renderNotification } from "./render";
import { isTelegramBlockedError, resolveTelegramLocale } from "./telegram";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface TelegramSendResult {
  ok: boolean;
  /** Telegram error_code (403 = bot bloklangan) yoki HTTP status; tarmoq xatosi → 0 */
  code: number;
  description?: string;
  transient: boolean;
}

/**
 * sendMessage — `@/lib/telegram/bot`.sendTelegramMessage bilan bir xil payload, lekin
 * error_code qaytaradi (403 → bot_started=false qilish uchun). Log: bot.ts bilan bir xil format.
 */
export async function sendTelegramHtml(chatId: number, html: string, keyboard?: ReplyMarkup): Promise<TelegramSendResult> {
  const { TELEGRAM_BOT_TOKEN } = getServerEnv();
  if (!TELEGRAM_BOT_TOKEN) return { ok: false, code: 0, description: "telegram_not_configured", transient: false };
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: "HTML", reply_markup: keyboard, disable_web_page_preview: true }),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as { ok: boolean; error_code?: number; description?: string } | null;
    if (data?.ok) return { ok: true, code: 200, transient: false };
    const code = data?.error_code ?? res.status;
    console.warn(`[telegram] sendMessage: ${data?.description ?? res.status}`);
    return { ok: false, code, description: data?.description, transient: code === 429 || code >= 500 };
  } catch (e) {
    console.warn("[telegram] sendMessage network", e instanceof Error ? e.message : e);
    return { ok: false, code: 0, transient: true };
  }
}

export interface DispatchCounts {
  scanned: number;
  sent: number;
  blocked: number;
  failed: number;
  skipped: number;
}

/**
 * Yuborilmagan (telegram_sent_at is null, 2 kundan yangi) bildirishnomalarni botni ishga tushirgan
 * foydalanuvchilarga yuboradi. 403 → bot_started=false. Vaqtinchalik xato (429/5xx/tarmoq) → keyingi safar.
 */
export async function dispatchTelegramNotifications(admin: AdminClient, opts: { limit?: number; now?: Date } = {}): Promise<DispatchCounts> {
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 500);
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const counts: DispatchCounts = { scanned: 0, sent: 0, blocked: 0, failed: 0, skipped: 0 };

  const { data, error } = await admin
    .from("notifications")
    .select("id, type, payload, link, profile_id, profiles!inner(locale, telegram_accounts!inner(telegram_user_id, bot_started, language_code))")
    .is("telegram_sent_at", null)
    .gte("created_at", since)
    .eq("profiles.telegram_accounts.bot_started", true)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`notifications query: ${error.message}`);

  const rows = data ?? [];
  counts.scanned = rows.length;
  const sentIds: number[] = [];
  const blockedProfiles = new Set<string>();

  for (const n of rows) {
    const tg = n.profiles?.telegram_accounts;
    if (!tg || !tg.bot_started) {
      counts.skipped += 1;
      continue;
    }
    const locale = resolveTelegramLocale([n.profiles?.locale, tg.language_code]);
    const t = makeT(locale);
    const rendered = renderNotification(n.type, n.payload, t, locale);
    const html = rendered.body ? `<b>${escapeHtml(rendered.title)}</b>\n${escapeHtml(rendered.body)}` : `<b>${escapeHtml(rendered.title)}</b>`;
    const link = n.link && n.link.startsWith("/") ? n.link : "/";
    const result = await sendTelegramHtml(tg.telegram_user_id, html, openAppKeyboard(t("notifications.telegram.open"), link));

    if (result.ok) {
      counts.sent += 1;
      sentIds.push(n.id);
    } else if (isTelegramBlockedError(result.code, result.description)) {
      counts.blocked += 1;
      sentIds.push(n.id);
      blockedProfiles.add(n.profile_id);
    } else if (result.transient) {
      counts.failed += 1; // keyingi ishga tushishda qayta uriniladi
    } else {
      counts.failed += 1;
      sentIds.push(n.id); // doimiy xato (masalan, noto'g'ri HTML) — qayta urinmaymiz
    }
  }

  if (sentIds.length) {
    const { error: updErr } = await admin.from("notifications").update({ telegram_sent_at: now.toISOString() }).in("id", sentIds);
    if (updErr) console.error("[telegram] mark sent", updErr.message);
  }
  if (blockedProfiles.size) {
    const { error: blkErr } = await admin.from("telegram_accounts").update({ bot_started: false }).in("profile_id", [...blockedProfiles]);
    if (blkErr) console.error("[telegram] bot_started=false", blkErr.message);
  }
  return counts;
}
