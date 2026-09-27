"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { getPromotionQuote, promoteWorker } from "../actions";
import type { PromotionQuote } from "../types";
import { billingErrorMessage, requestPayment } from "./payment-dialog";

/** Ishchi bosh sahifasi: "Profilni TOP ga chiqarish" (bepul/aksiya — darhol, aks holda to'lov oynasi) */
export function TopProfileCard({ workerId, promotedUntil }: { workerId: string; promotedUntil: string | null }) {
  const { t, locale } = useT();
  const router = useRouter();
  const [quote, setQuote] = useState<PromotionQuote | null>(null);
  const [pending, startTransition] = useTransition();
  const [now] = useState(() => Date.now());
  const active = !!promotedUntil && new Date(promotedUntil).getTime() > now;

  useEffect(() => {
    let alive = true;
    getPromotionQuote().then((res) => alive && res.ok && res.data && setQuote(res.data));
    return () => {
      alive = false;
    };
  }, [promotedUntil]);

  const promote = () =>
    startTransition(async () => {
      const res = await promoteWorker();
      if (!res.ok) {
        if (res.error === "payment_required") {
          requestPayment({ purpose: "worker_promotion", targetId: workerId });
          return;
        }
        toast.error(billingErrorMessage(t, res.error) ?? t("common.errors.generic"));
        return;
      }
      toast.success(t("billing.top.done"));
      router.refresh();
    });

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-warning/40 bg-gradient-to-br from-warning-soft to-card p-4 sm:flex-row sm:items-center">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-warning text-warning-foreground shadow-sm">
        <Crown className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{t("billing.top.title")}</p>
        <p className="text-sm text-muted-foreground">{active ? t("billing.top.active", { date: formatDateTime(promotedUntil, locale) }) : t("billing.top.desc")}</p>
        {quote && !active ? (
          <p className="mt-1 text-xs font-medium text-warning">
            {t(`billing.promo_mode.${quote.mode}`, { date: formatDate(quote.promo_until, locale), hours: quote.hours, price: formatMoney(quote.price, locale, { withCurrency: false }) })}
          </p>
        ) : null}
      </div>
      {!active ? (
        <Button onClick={promote} loading={pending} className="shrink-0 bg-warning text-warning-foreground hover:bg-warning/90">
          <Crown className="size-4" />
          {t("billing.top.button")}
        </Button>
      ) : null}
    </section>
  );
}
