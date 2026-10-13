"use client";

import { useId, useState, useTransition } from "react";
import { CreditCard, Gift } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { useAndroidApp } from "@/lib/use-android-app";
import { formatMoney } from "@/lib/format";
import { callAction } from "@/lib/action-call";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { startTopup } from "../actions";
import { LAST_PROVIDER_KEY, TOPUP_PRESETS, orderProviders, parseAmount, topupBonus } from "../pricing";
import type { PaymentProvider } from "../providers";
import type { WalletInfo } from "../types";
import { InAppNote } from "./in-app-note";
import { useBillingError } from "./checkout-panel";

const PROVIDER_NAME = { payme: "Payme", click: "Click" } as const;

/**
 * Hamyonni to'ldirish: tayyor summalar (bir bosish) yoki o'z summasi, bonus oldindan ko'rinadi, so'ng Payme/Click.
 * Summa chegaralari va bonus serverda qayta tekshiriladi (create_topup, apply_payment_internal).
 */
export function WalletTopup({ wallet, providers }: { wallet: WalletInfo; providers: PaymentProvider[] }) {
  const { t, locale } = useT();
  const inApp = useAndroidApp();
  const errorText = useBillingError();
  const presets = TOPUP_PRESETS.filter((p) => p >= wallet.topupMin && p <= wallet.topupMax);
  const [amount, setAmount] = useState<number | null>(presets[1] ?? presets[0] ?? wallet.topupMin);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [last] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(LAST_PROVIDER_KEY);
    } catch {
      return null;
    }
  });
  const customId = useId();

  if (inApp) return <InAppNote />;

  const money = (n: number) => formatMoney(n, locale);
  const valid = amount !== null && amount >= wallet.topupMin && amount <= wallet.topupMax;
  const bonus = valid ? topupBonus(amount, wallet.bonusPercent, wallet.bonusMin) : 0;
  const ordered = orderProviders(providers, last);

  const pay = (provider: PaymentProvider) => {
    if (!valid || amount === null) return;
    setBusy(provider);
    try {
      localStorage.setItem(LAST_PROVIDER_KEY, provider);
    } catch {
      /* eslab qolinmaydi */
    }
    start(async () => {
      const res = await callAction(() => startTopup({ amount, provider }));
      if (!res.ok || !res.data) {
        setBusy(null);
        toast.error(errorText(res.ok ? "generic" : res.error));
        return;
      }
      window.location.href = res.data.url;
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">{t("billing.wallet.topup_title")}</h3>
      <div role="radiogroup" aria-label={t("billing.wallet.topup_title")} className="grid grid-cols-2 gap-2">
        {presets.map((p) => {
          const on = amount === p && !custom;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setCustom("");
                setAmount(p);
              }}
              className={cn(
                "press flex min-h-14 flex-col items-center justify-center rounded-2xl border-2 px-3 py-2 text-lg font-bold tabular",
                on ? "border-primary bg-primary-soft text-primary" : "border-border bg-card hover:border-primary/50",
              )}
            >
              {money(p)}
              {topupBonus(p, wallet.bonusPercent, wallet.bonusMin) ? (
                <span className="text-xs font-semibold text-success">{t("billing.wallet.bonus_preview", { amount: money(topupBonus(p, wallet.bonusPercent, wallet.bonusMin)) })}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="space-y-1.5">
        <label htmlFor={customId} className="text-sm font-semibold">
          {t("billing.wallet.custom")}
        </label>
        <Input
          id={customId}
          inputMode="numeric"
          value={custom}
          placeholder={t("billing.wallet.custom_placeholder")}
          onChange={(e) => {
            setCustom(e.target.value);
            setAmount(parseAmount(e.target.value));
          }}
          aria-invalid={!!custom && !valid}
          aria-describedby={`${customId}-range`}
          className="h-14 text-lg"
        />
        <p id={`${customId}-range`} className={cn("text-sm", custom && !valid ? "font-semibold text-destructive" : "text-muted-foreground")}>
          {t("billing.wallet.range", { min: money(wallet.topupMin), max: money(wallet.topupMax) })}
        </p>
      </div>
      {wallet.bonusPercent > 0 ? (
        <p className="flex items-center gap-2 rounded-2xl bg-success-soft px-4 py-3 text-sm font-semibold">
          <Gift className="size-5 shrink-0 text-success" aria-hidden />
          {bonus > 0 ? t("billing.wallet.bonus_preview", { amount: money(bonus) }) : t("billing.wallet.bonus_hint", { min: money(wallet.bonusMin), percent: wallet.bonusPercent })}
        </p>
      ) : null}
      {ordered.length ? (
        <div className="grid gap-2">
          {ordered.map((p, i) => (
            <Button
              key={p}
              size="xl"
              variant={i === 0 ? "default" : "outline"}
              className="h-auto min-h-14 w-full whitespace-normal py-3 text-lg"
              disabled={!valid || pending}
              loading={busy === p}
              onClick={() => pay(p)}
              data-provider={p}
            >
              <CreditCard className="size-5" aria-hidden />
              {t("billing.wallet.pay_topup", { provider: PROVIDER_NAME[p], amount: valid && amount !== null ? money(amount) : "" })}
            </Button>
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-warning-soft p-3 text-sm">{t("billing.no_providers")}</p>
      )}
    </div>
  );
}
