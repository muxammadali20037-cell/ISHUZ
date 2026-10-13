"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { useAndroidApp } from "@/lib/use-android-app";
import { formatDate, formatMoney } from "@/lib/format";
import { Dialog, Sheet } from "@/components/ui/dialog";
import { getVacancyQuote } from "../actions";
import type { CheckoutPurpose, VacancyQuote } from "../types";
import { CheckoutPanel } from "./checkout-panel";

export { InAppNote } from "./in-app-note";

type Request = { purpose: CheckoutPurpose; targetId: string | null };

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
      {req ? <PaymentSheet req={req} onDone={() => setReq(null)} /> : null}
    </Dialog>
  );
}

const TITLES = {
  vacancy_publish: "billing.vacancy_title",
  worker_listing: "billing.listing_title",
  worker_promotion: "billing.promotion_title",
  ai_alerts: "saved.ai_alerts.pro",
} as const;

function PaymentSheet({ req, onDone }: { req: Request; onDone: () => void }) {
  const { t } = useT();
  return (
    <Sheet title={t(TITLES[req.purpose])}>
      <div className="px-5 pb-6">
        <CheckoutPanel purpose={req.purpose} targetId={req.targetId} variant="sheet" onDone={onDone} />
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
    <p className="flex items-center gap-2 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm font-semibold text-warning">
      <span className="rounded-lg bg-warning px-2 py-0.5 text-base font-extrabold text-warning-foreground">−{percent}%</span>
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
