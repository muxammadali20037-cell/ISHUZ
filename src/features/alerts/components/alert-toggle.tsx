"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { BellOff, BellRing, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { getAlertStatus, saveAlertSubscription } from "../actions";
import type { AlertRole, AlertStatus } from "../types";

/**
 * "Menga mos ish chiqsa xabar bering" / "Menga mos ishchi topilsa xabar bering".
 * Telegram bog'lanmagan bo'lsa — bir martalik havola bilan "Botni ochish"; bot xabar yetkazmaguncha
 * "Obuna yoqildi" deb ko'rsatilmaydi (holat har 3 soniyada tekshiriladi).
 */
export function AlertToggle({
  role,
  initialStatus,
  defaults,
  compact = false,
}: {
  role: AlertRole;
  initialStatus: AlertStatus;
  defaults?: { professionNodeId?: string | null; regionId?: string | null; vacancyIds?: string[] };
  compact?: boolean;
}) {
  const { t } = useT();
  const [status, setStatus] = useState<AlertStatus>(initialStatus);
  const [botUrl, setBotUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // bot ochilishini kutish
  useEffect(() => {
    if (status !== "needs_bot") return;
    let alive = true;
    let tries = 0;
    const id = setInterval(async () => {
      tries += 1;
      if (tries > 100) return clearInterval(id);
      const res = await getAlertStatus({ role });
      if (alive && res.ok && res.data && res.data.status !== "needs_bot") {
        setStatus(res.data.status);
        clearInterval(id);
      }
    }, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [status, role]);

  const save = (enabled: boolean) =>
    start(async () => {
      setError(null);
      const res = await saveAlertSubscription({
        role,
        enabled,
        mode: "instant",
        professionNodeId: defaults?.professionNodeId ?? null,
        regionId: defaults?.regionId ?? null,
        vacancyIds: defaults?.vacancyIds ?? [],
      });
      if (!res.ok || !res.data) {
        const key = `easy.errors.${res.ok ? "generic" : res.error}`;
        const msg = t(key);
        setError(msg === key ? t("easy.errors.generic") : msg);
        return;
      }
      setStatus(res.data.status);
      setBotUrl(res.data.botUrl);
      if (res.data.status === "needs_bot" && !res.data.botConfigured) setError(t("easy.alerts.bot_missing"));
    });

  const label = t(role === "worker" ? "easy.alerts.worker_cta" : "easy.alerts.employer_cta");

  if (status === "active") {
    return (
      <div className={cn("rounded-2xl border-2 border-success/50 bg-success-soft p-4", compact ? "" : "mt-6")} role="status">
        <p className="flex items-center gap-2 text-lg font-bold text-success">
          <BellRing className="size-6 shrink-0" aria-hidden /> {t("easy.alerts.on_title")}
        </p>
        <p className="mt-1 text-base text-foreground/80">{t(role === "worker" ? "easy.alerts.on_desc_worker" : "easy.alerts.on_desc_employer")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="outline" className="min-h-12 text-base">
            <Link href="/cabinet/alerts">{t("easy.alerts.settings")}</Link>
          </Button>
          <Button variant="ghost" className="min-h-12 text-base" disabled={pending} onClick={() => save(false)}>
            <BellOff className="size-5" aria-hidden /> {t("easy.alerts.stop")}
          </Button>
        </div>
      </div>
    );
  }

  if (status === "needs_bot") {
    return (
      <div className={cn("rounded-2xl border-2 border-primary/40 bg-primary-soft/60 p-4", compact ? "" : "mt-6")} role="status" aria-live="polite">
        <p className="text-lg font-bold">{t("easy.alerts.needs_bot_title")}</p>
        <p className="mt-1 text-base text-foreground/80">{t("easy.alerts.needs_bot_desc")}</p>
        {botUrl ? (
          <Button asChild size="xl" className="mt-3 h-14 w-full text-lg">
            <a href={botUrl} target="_blank" rel="noopener noreferrer">
              <Send className="size-5" aria-hidden /> {t("easy.alerts.open_bot")}
            </a>
          </Button>
        ) : (
          <Button size="xl" className="mt-3 h-14 w-full text-lg" disabled={pending} onClick={() => save(true)}>
            <Send className="size-5" aria-hidden /> {t("easy.alerts.get_link")}
          </Button>
        )}
        <p className="mt-2 text-sm text-muted-foreground">{t("easy.alerts.waiting")}</p>
        {error ? <p className="mt-2 text-base font-semibold text-destructive" role="alert">{error}</p> : null}
        <Button variant="ghost" className="mt-1 min-h-12 text-base" disabled={pending} onClick={() => save(false)}>
          {t("easy.alerts.cancel")}
        </Button>
      </div>
    );
  }

  return (
    <div className={compact ? "" : "mt-6"}>
      <Button size="xl" variant="outline" className="h-auto min-h-14 w-full whitespace-normal border-2 py-3 text-lg" disabled={pending} onClick={() => save(true)}>
        <BellRing className="size-6 shrink-0 text-primary" aria-hidden /> {pending ? t("easy.wizard.saving") : label}
      </Button>
      <p className="mt-2 text-center text-sm text-muted-foreground">{t("easy.alerts.hint")}</p>
      {error ? <p className="mt-2 text-base font-semibold text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}
