"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";
import { makeT } from "@/lib/i18n/translate";
import { miniAppBaseUrl } from "@/lib/telegram/bot";
import { getSession } from "@/features/auth/session";
import type { ActionResult } from "@/features/auth/actions";
import { errorCode } from "@/lib/utils";
import { sendTelegramHtml } from "@/features/notifications/telegram-dispatch";
import { isTelegramBlockedError, resolveTelegramLocale } from "@/features/notifications/telegram";
import { trackServer } from "@/features/analytics/server";
import type { AlertStatus } from "./types";

const schema = z.object({
  role: z.enum(["worker", "employer"]),
  enabled: z.boolean(),
  mode: z.enum(["instant", "digest"]).default("instant"),
  professionNodeId: z.uuid().nullable().optional(),
  regionId: z.uuid().nullable().optional(),
  salaryMin: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  schedules: z.array(z.enum(["5_2", "6_1", "2_2", "shift", "flexible", "negotiable"])).max(6).optional(),
  vacancyIds: z.array(z.uuid()).max(50).optional(),
});

export interface AlertResult {
  status: AlertStatus;
  /** Telegram bog'lanmagan bo'lsa: bir martalik /start havolasi (15 daqiqa) */
  botUrl: string | null;
  botConfigured: boolean;
}

/** Bir martalik token: faqat xeshi bazada; /start sub_<token> bilan bot hisobni bog'laydi */
async function linkUrl(role: "worker" | "employer"): Promise<string | null> {
  const { TELEGRAM_BOT_USERNAME } = getServerEnv();
  if (!TELEGRAM_BOT_USERNAME) return null;
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_telegram_link_token", { p_token_hash: hash, p_role: role });
  if (error) throw new Error(errorCode(error));
  return `https://t.me/${TELEGRAM_BOT_USERNAME.replace(/^@/, "")}?start=sub_${token}`;
}

/**
 * Telegram allaqachon bog'langan bo'lsa — darhol tasdiq xabari yuboriladi. Bot yetkazsa — obuna faol.
 * Yetkaza olmasa (bot bloklangan / hali boshlanmagan) — "Botni ochish" havolasi qaytadi. Rozilik bo'lmaguncha xabar yuborilmaydi.
 */
async function confirmViaBot(userId: string, role: "worker" | "employer"): Promise<boolean> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  const admin = createAdminClient();
  const { data: tg } = await admin.from("telegram_accounts").select("telegram_user_id, bot_started, language_code, profiles(locale)").eq("profile_id", userId).maybeSingle();
  if (!tg) return false;
  const t = makeT(resolveTelegramLocale([tg.profiles?.locale, tg.language_code]));
  const sent = await sendTelegramHtml(tg.telegram_user_id, t(`notifications.telegram.subscribed_${role}`), {
    inline_keyboard: [[{ text: t("notifications.telegram.settings_button"), web_app: { url: `${miniAppBaseUrl()}/cabinet/alerts` } }]],
  });
  if (sent.ok) {
    await admin.rpc("confirm_match_subscription", { p_profile_id: userId, p_role: role });
    return true;
  }
  if (isTelegramBlockedError(sent.code, sent.description)) await admin.rpc("telegram_blocked", { p_profile_id: userId });
  return false;
}

export async function saveAlertSubscription(input: unknown): Promise<ActionResult<AlertResult>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_match_subscription", {
    p_role: v.role,
    p_enabled: v.enabled,
    p_mode: v.mode,
    p_profession_node_id: v.professionNodeId ?? undefined,
    p_region_id: v.regionId ?? undefined,
    p_salary_min: v.salaryMin ?? undefined,
    p_schedules: v.schedules ?? [],
    p_vacancy_ids: v.vacancyIds ?? [],
  });
  if (error) return { ok: false, error: errorCode(error) };
  const row = data as { enabled?: boolean; telegram_confirmed_at?: string | null } | null;
  const botConfigured = !!getServerEnv().TELEGRAM_BOT_USERNAME;
  after(() => trackServer(v.enabled ? "subscription_on" : "subscription_off", session.userId, { role: v.role }));
  revalidatePath("/cabinet");
  if (!v.enabled) return { ok: true, data: { status: "off", botUrl: null, botConfigured } };
  if (row?.telegram_confirmed_at) {
    const { data: tg } = await supabase.from("telegram_accounts").select("bot_started").eq("profile_id", session.userId).maybeSingle();
    if (tg?.bot_started) return { ok: true, data: { status: "active", botUrl: null, botConfigured } };
  }
  if (await confirmViaBot(session.userId, v.role)) return { ok: true, data: { status: "active", botUrl: null, botConfigured } };
  try {
    return { ok: true, data: { status: "needs_bot", botUrl: await linkUrl(v.role), botConfigured } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "generic" };
  }
}

/** Bot ochilgach holatni tekshirish (UI har bir necha soniyada so'raydi) */
export async function getAlertStatus(input: unknown): Promise<ActionResult<{ status: AlertStatus }>> {
  const parsed = z.object({ role: z.enum(["worker", "employer"]) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const [{ data: sub }, { data: tg }] = await Promise.all([
    supabase.from("match_subscriptions").select("enabled, telegram_confirmed_at").eq("profile_id", session.userId).eq("role", parsed.data.role).maybeSingle(),
    supabase.from("telegram_accounts").select("bot_started").eq("profile_id", session.userId).maybeSingle(),
  ]);
  const status: AlertStatus = !sub?.enabled ? "off" : sub.telegram_confirmed_at && tg?.bot_started ? "active" : "needs_bot";
  return { ok: true, data: { status } };
}
