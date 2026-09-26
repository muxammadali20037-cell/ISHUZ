import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { setBotMenuButton, setBotWebhook } from "@/lib/telegram/bot";
import { isCronAuthorized } from "@/features/notifications/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bir martalik sozlash: webhook (secret_token bilan) + menyu tugmasi (web_app).
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/telegram/setup
 */
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, APP_URL } = getServerEnv();
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_WEBHOOK_SECRET) return NextResponse.json({ error: "telegram_not_configured" }, { status: 503 });

  const webhookUrl = `${APP_URL.replace(/\/$/, "")}/api/telegram/webhook`;
  const [webhook, menu] = await Promise.all([setBotWebhook(webhookUrl, TELEGRAM_WEBHOOK_SECRET), setBotMenuButton()]);
  const ok = webhook !== null && menu !== null;
  return NextResponse.json({ ok, webhookUrl, webhook: webhook !== null, menuButton: menu !== null }, { status: ok ? 200 : 502 });
}
