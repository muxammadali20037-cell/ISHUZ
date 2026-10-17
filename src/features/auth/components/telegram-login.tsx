"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { useTelegram } from "@/lib/telegram/provider";
import { Spinner } from "@/components/ui/misc";
import { safeInternalPath } from "@/lib/security/safe-path";

/**
 * Telegram Mini App ichida: initData (serverda HMAC bilan tekshiriladi) orqali darhol kirish — telefon va kod so'ralmaydi.
 * Oddiy brauzerda hech narsa qilmaydi. Server rad etsa — `failed`, foydalanuvchi telefon orqali kiradi.
 */
export function useTelegramLogin(next: string): { loading: boolean; failed: boolean } {
  const { locale } = useT();
  const router = useRouter();
  const { isTelegram, webApp } = useTelegram();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!isTelegram || !webApp?.initData || started.current) return;
    started.current = true;
    fetch("/api/auth/telegram", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData: webApp.initData, locale }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        router.replace(safeInternalPath(next));
        router.refresh();
      })
      .catch(() => setFailed(true));
  }, [isTelegram, webApp, router, next, locale]);

  return { loading: isTelegram && !failed, failed };
}

/** Telegram ichida — "kirilmoqda" holati; aks holda (yoki rad etilsa) — oddiy kirish ekrani */
export function TelegramGate({ next, children }: { next: string; children: (failed: boolean) => ReactNode }) {
  const { t } = useT();
  const { loading, failed } = useTelegramLogin(next);
  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background p-6 text-center" role="status">
        <Spinner />
        <p className="text-base text-muted-foreground">{t("auth.telegram_auto")}</p>
      </div>
    );
  }
  return <>{children(failed)}</>;
}
