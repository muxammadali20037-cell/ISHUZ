"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, ExternalLink, Send } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { useTelegram } from "@/lib/telegram/provider";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { actionErrorMessage } from "../../i18n-helpers";

type Linked = { username: string | null; first_name: string | null; linked_at: string; bot_started: boolean } | null;

export function TelegramCard({ linked, botUsername }: { linked: Linked; botUsername: string | null }) {
  const { t, locale } = useT();
  const { isTelegram, webApp, notify } = useTelegram();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const link = async () => {
    if (!webApp?.initData) return;
    setPending(true);
    try {
      const res = await fetch("/api/auth/telegram/link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ initData: webApp.initData }) });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        notify("error");
        toast.error(actionErrorMessage(t, body.error ?? "generic"));
        return;
      }
      notify("success");
      toast.success(t("profile.settings.telegram_link_success"));
      router.refresh();
    } catch {
      toast.error(t("common.errors.network"));
    } finally {
      setPending(false);
    }
  };

  if (linked) {
    return (
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Send className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {linked.username ? `@${linked.username}` : linked.first_name || t("profile.settings.telegram_linked")}
            <Badge variant="success">
              <BadgeCheck /> {t("profile.settings.telegram_linked")}
            </Badge>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("profile.settings.telegram_linked_at", { date: formatDate(linked.linked_at, locale) })}</p>
          <p className={linked.bot_started ? "mt-1 text-xs text-success" : "mt-1 text-xs text-warning"}>{linked.bot_started ? t("profile.settings.telegram_bot_started") : t("profile.settings.telegram_bot_not_started")}</p>
          {!linked.bot_started && botUsername ? (
            <Button asChild variant="link" size="sm" className="mt-1 h-auto px-0">
              <a href={`https://t.me/${botUsername}`} target="_blank" rel="noopener noreferrer">
                {t("profile.settings.telegram_open_bot")} <ExternalLink className="size-3.5" />
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("profile.settings.telegram_not_linked")}</p>
      {isTelegram ? (
        <Button type="button" onClick={link} loading={pending}>
          <Send className="size-4" /> {t("profile.settings.telegram_link")}
        </Button>
      ) : (
        <>
          <p className="text-sm">{t("profile.settings.telegram_hint")}</p>
          {botUsername ? (
            <Button asChild variant="outline">
              <a href={`https://t.me/${botUsername}`} target="_blank" rel="noopener noreferrer">
                <Send className="size-4" /> {t("profile.settings.telegram_open_bot")}
              </a>
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
