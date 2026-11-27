"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, CreditCard, Crown, Lock, ReceiptText, RotateCcw, Wallet } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { usePurchaseLock } from "@/lib/use-purchase-lock";
import { formatMoney } from "@/lib/format";
import { callAction } from "@/lib/action-call";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { getCheckout, payFromWallet, startCheckout } from "../actions";
import { LAST_PROVIDER_KEY, orderProviders, perDay } from "../pricing";
import type { CheckoutPurpose, CheckoutQuote, TariffPlan, Tier } from "../types";
import { selectableTiers } from "../tiers";
import { InAppNote } from "./in-app-note";

/** reveal-phone.tsx dagi CONTACT_UNLOCKED_EVENT bilan bir xil (billing → contacts bog'liqligi bo'lmasin) */
const CONTACT_UNLOCKED_EVENT = "ib:contact-unlocked";

const PROVIDER_NAME = { payme: "Payme", click: "Click" } as const;

function lastProvider(): string | null {
  try {
    return localStorage.getItem(LAST_PROVIDER_KEY);
  } catch {
    return null;
  }
}

/** Server xato kodi → tushunarli matn (billing.errors.*); noma'lum bo'lsa — umumiy xato */
export function useBillingError() {
  const { t } = useT();
  return (code: string) => {
    const key = `billing.errors.${code}`;
    const msg = t(key);
    return msg === key ? t("common.errors.generic") : msg;
  };
}

/**
 * To'lov oynasi (F1): nima olinadi, narx (chegirma va kunlik narx bilan), to'lov usullari — hamyon (balans yetsa, bir
 * bosishda), so'ng Payme/Click (oxirgi ishlatilgani birinchi), ishonch qatorlari va "To'lovlarim" havolasi.
 *  · sheet — dialog ichida; inline — e'lon natijasi ekranida (to'lovgacha 1 bosish); compact — narx va foyda allaqachon
 *    ko'rsatilgan joyda (AI PRO), faqat usullar va ishonch.
 *  · Tariflar (0080): vakansiya va ishchi e'lonida — Oddiy · Tezkor · Maksimal tanlovi. `upgrade` — e'lon bepul yoki allaqachon
 *    faol bo'lsa ham kuchaytirish (Tezkor/Maksimal: uzoqroq muddat, TOP, ishchida AI PRO).
 * Narx, huquq va hamyon qoldig'i doim serverda tekshiriladi; bu yerda faqat ko'rsatiladi.
 */
export function CheckoutPanel({
  purpose,
  targetId,
  variant = "sheet",
  upgrade = false,
  onDone,
  className,
}: {
  purpose: CheckoutPurpose;
  targetId: string | null;
  variant?: "sheet" | "inline" | "compact";
  /** faol (bepul yoki to'langan) e'lonni kuchaytirish: faqat Tezkor va Maksimal */
  upgrade?: boolean;
  onDone?: () => void;
  className?: string;
}) {
  const { t, locale } = useT();
  const router = useRouter();
  const inApp = usePurchaseLock() !== null;
  const errorText = useBillingError();
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [picked, setPicked] = useState<TariffPlan | null>(null);
  const [pending, start] = useTransition();
  // brauzerda — shu qurilmada oxirgi tanlangan usul (serverda null; narx kelguncha skelet ko'rinadi, farq yo'q)
  const [last] = useState<string | null>(() => (typeof window === "undefined" ? null : lastProvider()));

  useEffect(() => {
    let alive = true;
    callAction(() => getCheckout({ purpose, targetId })).then((res) => {
      if (!alive) return;
      if (res.ok && res.data) setQuote(res.data);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [purpose, targetId]);

  if (inApp) return <InAppNote />;
  if (failed) return <p className="rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">{t("common.errors.generic")}</p>;
  if (!quote) return <Skeleton className={cn("w-full rounded-2xl", variant === "compact" ? "h-28" : "h-64", className)} />;
  const tiers = selectableTiers(quote.tiers, quote.mode, upgrade);
  if (quote.mode !== "payment_required" && !tiers.length) {
    return variant === "inline" ? null : <p className="rounded-2xl bg-success-soft p-4 text-sm font-medium">{t("billing.checkout.not_needed")}</p>;
  }

  // tanlangan daraja (sukut bo'yicha — eng arzoni: Oddiy yoki kuchaytirishda Tezkor)
  const tier: Tier | null = tiers.find((x) => x.plan === picked) ?? tiers[0] ?? null;
  const plan: TariffPlan | undefined = tier?.plan;
  const price = tier ? tier.price : quote.price;
  const fullPrice = tier ? tier.fullPrice : quote.fullPrice;
  const days = tier ? tier.days : quote.days;
  const discountPercent = tier ? (tier.price < tier.fullPrice ? quote.discountPercent : 0) : quote.discountPercent;
  const money = (n: number) => formatMoney(n, locale);
  const wallet = quote.wallet;
  const canWallet = !!wallet && wallet.balance >= price;
  const providers = orderProviders(quote.providers, last);
  const daily = perDay(price, days);
  const term = days ? t("billing.checkout.term_days", { days }) : quote.hours ? t("billing.checkout.term_hours", { hours: quote.hours }) : null;
  const benefits = [
    ...(upgrade && tier ? [] : [0, 1, 2].map((i) => t(`billing.checkout.benefits.${purpose}.${i}`, { days, hours: quote.hours }))),
    ...(tier && (upgrade || tier.plan !== "basic") ? [t("billing.tiers.benefit_days", { days: tier.days })] : []),
    ...(tier && tier.topDays > 0 ? [t(purpose === "worker_listing" ? "billing.tiers.benefit_top_worker" : "billing.tiers.benefit_top", { days: tier.topDays })] : []),
  ];

  const pay = (provider: "payme" | "click") => {
    setBusy(provider);
    try {
      localStorage.setItem(LAST_PROVIDER_KEY, provider);
    } catch {
      /* xususiy rejim — eslab qolinmaydi */
    }
    start(async () => {
      const res = await callAction(() => startCheckout({ purpose, targetId, provider, plan }));
      if (!res.ok || !res.data) {
        setBusy(null);
        toast.error(errorText(res.ok ? "generic" : res.error));
        return;
      }
      window.location.href = res.data.url;
    });
  };

  const payWallet = () => {
    setBusy("wallet");
    start(async () => {
      const res = await callAction(() => payFromWallet({ purpose, targetId, plan }));
      if (!res.ok || !res.data) {
        setBusy(null);
        toast.error(errorText(res.ok ? "generic" : res.error));
        return;
      }
      toast.success(t(purpose === "contact_unlock" ? "billing.checkout.contact_paid_toast" : "billing.checkout.paid_toast"));
      onDone?.();
      if (purpose === "contact_unlock") {
        // raqam shu sahifaning o'zida ochiladi (to'lov cheki — "To'lovlarim"da)
        window.dispatchEvent(new CustomEvent(CONTACT_UNLOCKED_EVENT, { detail: targetId }));
        router.refresh();
        return;
      }
      router.push(`/billing/return?order=${res.data.orderNo}`);
    });
  };

  return (
    <div className={cn("space-y-4", className)} data-testid="checkout">
      {tiers.length > 1 ? (
        <fieldset data-tiers>
          <legend className="mb-2 text-base font-bold">{upgrade ? t("billing.tiers.upgrade_title") : t("billing.tiers.choose")}</legend>
          <div className={cn("grid gap-2", tiers.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
            {tiers.map((x) => {
              const on = x.plan === tier?.plan;
              return (
                <label
                  key={x.plan}
                  data-tier={x.plan}
                  className={cn(
                    "press relative flex min-h-11 cursor-pointer flex-col gap-1 rounded-xl border-2 p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                    on ? "border-primary bg-primary-soft" : "border-border bg-card hover:border-primary/50",
                  )}
                >
                  <input type="radio" name="tariff" value={x.plan} checked={on} onChange={() => setPicked(x.plan)} className="sr-only" />
                  <span className="flex items-center gap-1.5 text-base font-bold">
                    {x.plan === "max" ? <Crown className="size-4 text-warning" aria-hidden /> : null}
                    {t(`billing.tiers.${x.plan}`)}
                  </span>
                  <span className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="whitespace-nowrap text-lg font-extrabold tabular">{money(x.price)}</span>
                    {x.price < x.fullPrice ? <s className="whitespace-nowrap text-sm text-muted-foreground tabular">{money(x.fullPrice)}</s> : null}
                  </span>
                  <span className="text-sm leading-snug text-muted-foreground">
                    {[
                      t("billing.tiers.days", { days: x.days }),
                      x.topDays ? t("billing.tiers.top", { days: x.topDays }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}
      {variant !== "compact" ? (
        <>
          <ul className="space-y-2" aria-label={t("billing.pay_title")}>
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-base leading-snug">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-muted-foreground">{t("billing.checkout.price_label")}</p>
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="whitespace-nowrap text-3xl font-extrabold tracking-tight tabular" data-testid="checkout-price">
                {money(price)}
              </span>
              {discountPercent > 0 ? <s className="whitespace-nowrap text-base text-muted-foreground tabular">{money(fullPrice)}</s> : null}
            </p>
            {term ? (
              <p className="mt-1 text-base text-muted-foreground">
                <span className="font-bold text-foreground">{term}</span>
                {daily ? <> · {t("billing.checkout.per_day", { amount: money(daily) })}</> : null}
              </p>
            ) : null}
          </div>
          {discountPercent > 0 ? (
            <p className="flex items-center gap-2 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm font-semibold text-warning">
              <span className="rounded-lg bg-warning px-2 py-0.5 text-base font-extrabold text-warning-foreground">−{discountPercent}%</span>
              <span className="min-w-0">
                {t("billing.discount", {
                  percent: discountPercent,
                  date: quote.discountUntil ? new Date(quote.discountUntil).toLocaleDateString(locale === "en" ? "en-GB" : "ru-RU", { timeZone: "Asia/Tashkent" }) : "",
                })}
              </span>
            </p>
          ) : null}
        </>
      ) : null}

      <div className="grid gap-2">
        {canWallet ? (
          <>
            <Button size="xl" className="h-auto min-h-14 w-full whitespace-normal py-3 text-lg" loading={busy === "wallet"} disabled={pending} onClick={payWallet}>
              <Wallet className="size-5" aria-hidden />
              <span>
                {t("billing.checkout.pay_wallet")} · <span className="whitespace-nowrap">{money(price)}</span>
              </span>
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t("billing.checkout.balance", { amount: money(wallet.balance) })} · {t("billing.checkout.balance_after", { amount: money(wallet.balance - price) })}
            </p>
            {providers.length ? <p className="pt-1 text-center text-sm font-medium text-muted-foreground">{t("billing.checkout.or_card")}</p> : null}
          </>
        ) : wallet ? (
          <p className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary px-3 py-2 text-sm">
            <span>{t("billing.checkout.balance_low", { amount: money(wallet.balance) })}</span>
            <Link href="/billing" className="font-semibold text-primary-ink underline-offset-4 hover:underline">
              {t("billing.checkout.topup_link")}
            </Link>
          </p>
        ) : null}

        {providers.length ? (
          providers.map((p, i) => (
            <Button
              key={p}
              size="xl"
              variant={i === 0 && !canWallet ? "default" : "outline"}
              className="h-auto min-h-14 w-full whitespace-normal py-3 text-lg"
              loading={busy === p}
              disabled={pending}
              onClick={() => pay(p)}
              data-provider={p}
            >
              <CreditCard className="size-5" aria-hidden />
              {t("billing.checkout.provider_pay", { provider: PROVIDER_NAME[p] })}
            </Button>
          ))
        ) : !canWallet ? (
          <p className="rounded-xl bg-warning-soft p-3 text-sm">{t("billing.no_providers")}</p>
        ) : null}
      </div>

      <ul className="space-y-1.5 text-sm text-muted-foreground">
        <li className="flex items-start gap-2">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("billing.checkout.trust.secure")}
        </li>
        <li className="flex items-start gap-2">
          <ReceiptText className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("billing.checkout.trust.receipt")}
        </li>
        {purpose === "vacancy_publish" && days ? (
          <li className="flex items-start gap-2">
            <RotateCcw className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("billing.checkout.trust.resubmit", { days })}
          </li>
        ) : null}
      </ul>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href="/billing" className="inline-flex min-h-11 items-center font-semibold text-primary-ink underline-offset-4 hover:underline">
          {t("billing.checkout.history_link")}
        </Link>
        <Link href="/help" className="inline-flex min-h-11 items-center font-semibold text-primary-ink underline-offset-4 hover:underline">
          {t("billing.checkout.help")}
        </Link>
      </p>
    </div>
  );
}
