"use client";

import { useState, useTransition } from "react";
import { BellRing, Send } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { aiAlertsTelegramLink } from "../actions";

/**
 * AI yordamchi xabarlari Telegram orqali keladi. Ulanmagan bo'lsa — bir martalik (15 daqiqalik) xavfsiz havola:
 * bot hisobni chat_id bo'yicha bog'laydi. Ulangan bo'lsa — yashil tasdiq.
 */
export function TelegramConnect({ connected, botConfigured }: { connected: boolean; botConfigured: boolean }) {
  const { t } = useT();
  const [url, setUrl] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (connected) {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-success-soft p-3 text-sm font-medium">
        <BellRing className="size-4 shrink-0 text-success" /> {t("saved.ai_alerts.tg_ok")}
      </p>
    );
  }

  const link = () =>
    start(async () => {
      const res = await aiAlertsTelegramLink();
      if (!res.ok || !res.data) {
        toast.error(t("common.errors.generic"));
        return;
      }
      setUrl(res.data.url);
    });

  return (
    <div className="flex items-start gap-3 rounded-2xl border-2 border-warning bg-warning-soft p-4">
      <Send className="mt-0.5 size-5 shrink-0 text-warning" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{t("saved.ai_alerts.tg_title")}</p>
        <p className="text-sm text-muted-foreground">{t("saved.ai_alerts.tg_desc")}</p>
        {botConfigured ? (
          url ? (
            <>
              <Button asChild size="sm" className="mt-3 bg-[#229ED9] text-white hover:bg-[#229ED9]/90">
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <Send className="size-4" /> {t("saved.ai_alerts.tg_open")}
                </a>
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">{t("saved.ai_alerts.tg_hint")}</p>
            </>
          ) : (
            <Button size="sm" className="mt-3 bg-[#229ED9] text-white hover:bg-[#229ED9]/90" loading={pending} onClick={link}>
              <Send className="size-4" /> {t("saved.ai_alerts.tg_connect")}
            </Button>
          )
        ) : null}
      </div>
    </div>
  );
}
