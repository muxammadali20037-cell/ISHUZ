import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { setBotCommands, setBotMenuButton, setBotWebhook } from "@/lib/telegram/bot";
import { makeT } from "@/lib/i18n/translate";
import { isCronAuthorized } from "@/features/notifications/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bir martalik sozlash: webhook (secret_token bilan) + menyu tugmasi (web_app) + buyruqlar ro'yxati (/cv, /jobs, /pdf, /lang).
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/telegram/setup
 */
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, APP_URL } = getServerEnv();
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_WEBHOOK_SECRET) return NextResponse.json({ error: "telegram_not_configured" }, { status: 503 });

  const webhookUrl = `${APP_URL.replace(/\/$/, "")}/api/telegram/webhook`;
  const commands = (locale: "uz" | "ru" | "en") => {
    const t = makeT(locale);
    return (["start", "cv", "jobs", "pdf", "lang"] as const).map((command) => ({ command, description: t(`bot.menu.cmd_${command}`) }));
  };
  const [webhook, menu, cmdDefault, cmdRu] = await Promise.all([
    setBotWebhook(webhookUrl, TELEGRAM_WEBHOOK_SECRET),
    setBotMenuButton(),
    setBotCommands(commands("uz")),
    setBotCommands(commands("ru"), "ru"),
  ]);
  const ok = webhook !== null && menu !== null;
  return NextResponse.json(
    { ok, webhookUrl, webhook: webhook !== null, menuButton: menu !== null, commands: cmdDefault !== null && cmdRu !== null },
    { status: ok ? 200 : 502 },
  );
}
