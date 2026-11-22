import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { requireSession } from "@/features/auth/session";
import { Shell } from "@/components/shared/shell";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { TelegramConnect } from "@/features/ai-alerts/components/telegram-connect";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("easy.alerts.title"), robots: { index: false } };
}

/**
 * /cabinet/alerts — Telegram'ni ulash (xabarlar, e'lon holati va boshqa bildirishnomalar Telegram'ga keladi). "Mos ish /
 * mos ishchi chiqsa xabar bering" sozlamalari yo'q (ega, 2026-11-22: "moslik umuman kerak emas").
 */
export default async function Page() {
  const session = await requireSession("/cabinet/alerts");
  const { t } = await getT();
  const supabase = await createClient();
  const { data: tg } = await supabase.from("telegram_accounts").select("bot_started").eq("profile_id", session.userId).maybeSingle();
  return (
    <Shell>
      <div className="container-narrow space-y-6 py-6 text-lg sm:py-8">
        <div>
          <h1 className="text-page font-extrabold sm:text-page-lg">{t("easy.alerts.title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("easy.alerts.intro")}</p>
        </div>
        <TelegramConnect connected={tg?.bot_started === true} botConfigured={!!getServerEnv().TELEGRAM_BOT_USERNAME} />
        <p className="text-sm text-muted-foreground">{t("easy.alerts.privacy")}</p>
      </div>
    </Shell>
  );
}
