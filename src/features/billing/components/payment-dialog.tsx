"use client";

import { useEffect, useState, useTransition } from "react";
import { CreditCard, Lock } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatDate, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, Sheet } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { getPromotionQuote, getVacancyQuote, startCheckout } from "../actions";
import type { PromotionQuote, VacancyQuote } from "../types";

type Request = { purpose: "vacancy_publish" | "worker_promotion"; targetId: string };

// Istalgan joydan ochish: requestPayment({...}) — PaymentDialogHost providers'da bitta
const listeners = new Set<(r: Request) => void>();
export function requestPayment(r: Request) {
  listeners.forEach((fn) => fn(r));
}

export function billingErrorMessage(t: (k: string) => string, code: string): string | null {
  const key = `billing.errors.${code}`;
  const msg = t(key);
  return msg === key ? null : msg;
}

export function PaymentDialogHost() {
  const [req, setReq] = useState<Request | null>(null);
  useEffect(() => {
    const fn = (r: Request) => setReq(r);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return (
    <Dialog open={!!req} onOpenChange={(o) => !o && setReq(null)}>
      {req ? <PaymentSheet req={req} /> : null}
    </Dialog>
  );
}

function PaymentSheet({ req }: { req: Request }) {
  const { t, locale } = useT();
  const [quote, setQuote] = useState<VacancyQuote | PromotionQuote | null>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (req.purpose === "vacancy_publish" ? getVacancyQuote(req.targetId) : getPromotionQuote()).then((res) => {
      if (alive && res.ok && res.data) setQuote(res.data);
    });
    return () => {
      alive = false;
    };
  }, [req]);

  const pay = (provider: "payme" | "click") => {
    setBusy(provider);
    startTransition(async () => {
      const res = await startCheckout({ purpose: req.purpose, targetId: req.targetId, provider });
      if (!res.ok || !res.data) {
        setBusy(null);
        toast.error(billingErrorMessage(t, res.ok ? "" : res.error) ?? t("common.errors.generic"));
        return;
      }
      window.location.href = res.data.url;
    });
  };

  const isVacancy = req.purpose === "vacancy_publish";
  const title = t(isVacancy ? "billing.vacancy_title" : "billing.promotion_title");
  const description =
    quote && "lifetime_days" in quote ? t("billing.vacancy_desc", { days: quote.lifetime_days }) : quote && "hours" in quote ? t("billing.promotion_desc", { hours: quote.hours }) : undefined;

  return (
    <Sheet title={title} description={description}>
      <div className="space-y-4 px-5 pb-6">
        {!quote ? (
          <Skeleton className="h-24 w-full rounded-2xl" />
        ) : (
          <>
            <div className="flex items-baseline justify-between rounded-2xl bg-primary-soft/60 p-4">
              <span className="text-sm font-medium text-muted-foreground">{t("billing.pay_title")}</span>
              <span className="text-2xl font-bold tabular">{formatMoney(quote.price, locale)}</span>
            </div>
            {quote.providers.length ? (
              <div className="grid gap-2">
                {quote.providers.map((p) => (
                  <Button key={p} size="lg" variant={p === "payme" ? "default" : "outline"} loading={busy === p} disabled={pending} onClick={() => pay(p)}>
                    <CreditCard className="size-5" />
                    {t("billing.pay_with", { provider: p === "payme" ? "Payme" : "Click" })}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-warning-soft p-3 text-sm">{t("billing.no_providers")}</p>
            )}
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Lock className="mt-0.5 size-3.5 shrink-0" />
              {t("billing.secure")}
            </p>
          </>
        )}
      </div>
    </Sheet>
  );
}

/** "E'lon qilish" tugmasi ostidagi izoh: aksiya / bepul / to'langan / narx */
export function PublishModeNote({ vacancyId }: { vacancyId: string }) {
  const { t, locale } = useT();
  const [q, setQ] = useState<VacancyQuote | null>(null);
  useEffect(() => {
    let alive = true;
    getVacancyQuote(vacancyId).then((res) => alive && res.ok && res.data && setQ(res.data));
    return () => {
      alive = false;
    };
  }, [vacancyId]);
  if (!q) return null;
  const date = formatDate(q.mode === "paid_window" ? q.paid_until : q.promo_until, locale);
  return (
    <p className="mb-2 rounded-xl bg-primary-soft/60 px-3 py-2 text-sm font-medium text-primary">
      {t(`billing.mode.${q.mode}`, { date, hours: q.free_hours, price: formatMoney(q.price, locale, { withCurrency: false }), days: q.lifetime_days })}
    </p>
  );
}
