"use client";

import { useEffect, useState, useTransition } from "react";
import { CreditCard, Info, Lock } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { useAndroidApp } from "@/lib/use-android-app";
import { formatDate, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, Sheet } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { getPromotionQuote, getVacancyQuote, getWorkerListingQuote, startCheckout } from "../actions";
import type { ListingQuote, PromotionQuote, VacancyQuote } from "../types";

type Request = { purpose: "vacancy_publish" | "worker_promotion" | "worker_listing"; targetId: string };

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

/** Google Play ilovasida: narx va to'lov tugmalari o'rniga neytral izoh (Play to'lov qoidasi) */
export function InAppNote() {
  const { t } = useT();
  return (
    <p className="flex items-start gap-2 rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0" />
      {t("billing.in_app_note")}
    </p>
  );
}

function PaymentSheet({ req }: { req: Request }) {
  const { t, locale } = useT();
  const inApp = useAndroidApp();
  const [quote, setQuote] = useState<VacancyQuote | PromotionQuote | ListingQuote | null>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load: Promise<{ ok: boolean; data?: VacancyQuote | PromotionQuote | ListingQuote }> =
      req.purpose === "vacancy_publish" ? getVacancyQuote(req.targetId) : req.purpose === "worker_listing" ? getWorkerListingQuote() : getPromotionQuote();
    load.then((res) => {
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

  const title = t(req.purpose === "vacancy_publish" ? "billing.vacancy_title" : req.purpose === "worker_listing" ? "billing.listing_title" : "billing.promotion_title");
  const description =
    quote && "lifetime_days" in quote
      ? t(req.purpose === "worker_listing" ? "billing.listing_desc" : "billing.vacancy_desc", { days: quote.lifetime_days })
      : quote && "hours" in quote
        ? t("billing.promotion_desc", { hours: quote.hours })
        : undefined;

  return (
    <Sheet title={title} description={description}>
      <div className="space-y-4 px-5 pb-6">
        {inApp ? (
          <InAppNote />
        ) : !quote ? (
          <Skeleton className="h-24 w-full rounded-2xl" />
        ) : (
          <>
            <div className="flex items-baseline justify-between rounded-2xl bg-primary-soft/60 p-4">
              <span className="text-sm font-medium text-muted-foreground">{t("billing.pay_title")}</span>
              <span className="flex items-baseline gap-2">
                {"discount_percent" in quote && quote.discount_percent > 0 ? (
                  <s className="text-sm text-muted-foreground tabular">{formatMoney(quote.full_price, locale)}</s>
                ) : null}
                <span className="text-2xl font-bold tabular">{formatMoney(quote.price, locale)}</span>
              </span>
            </div>
            {"discount_percent" in quote && quote.discount_percent > 0 ? <DiscountBadge percent={quote.discount_percent} until={quote.discount_until} /> : null}
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

/** Aksiya: "−50% birinchi e'longa · 1-yanvar 2027 gacha" — ko'zga tashlanadigan rangda */
export function DiscountBadge({ percent, until }: { percent: number; until: string | null }) {
  const { t, locale } = useT();
  // aksiya Toshkent vaqti bilan 1-yanvar 00:00 da tugaydi — sanani shu vaqt zonasida ko'rsatamiz
  const date = until ? new Date(until).toLocaleDateString(locale === "en" ? "en-GB" : "ru-RU", { timeZone: "Asia/Tashkent" }) : "";
  return (
    <p className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-sm">
      <span className="rounded-lg bg-white/25 px-2 py-0.5 text-base font-extrabold">−{percent}%</span>
      <span className="min-w-0">{t("billing.discount", { percent, date })}</span>
    </p>
  );
}

/** "E'lon qilish" tugmasi ostidagi izoh: aksiya / bepul / to'langan / narx */
export function PublishModeNote({ vacancyId }: { vacancyId: string }) {
  const { t, locale } = useT();
  const inApp = useAndroidApp();
  const [q, setQ] = useState<VacancyQuote | null>(null);
  useEffect(() => {
    let alive = true;
    getVacancyQuote(vacancyId).then((res) => alive && res.ok && res.data && setQ(res.data));
    return () => {
      alive = false;
    };
  }, [vacancyId]);
  if (!q || (inApp && q.mode === "payment_required")) return null;
  const date = formatDate(q.mode === "paid_window" ? q.paid_until : q.promo_until, locale);
  const discounted = q.mode === "payment_required" && q.discount_percent > 0;
  return (
    <div className="mb-2 space-y-2">
      <p className="rounded-xl bg-primary-soft/60 px-3 py-2 text-sm font-medium text-primary">
        {t(`billing.mode.${discounted ? "payment_discount" : q.mode}`, {
          date,
          hours: q.free_hours,
          price: formatMoney(q.price, locale, { withCurrency: false }),
          full: formatMoney(q.full_price, locale, { withCurrency: false }),
          days: q.lifetime_days,
        })}
      </p>
      {discounted ? <DiscountBadge percent={q.discount_percent} until={q.discount_until} /> : null}
    </div>
  );
}
