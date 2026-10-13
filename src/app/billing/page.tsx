import type { Metadata } from "next";
import { BellRing, BriefcaseBusiness, Crown, Megaphone, ReceiptText, Wallet } from "lucide-react";
import { requireSession } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { formatDateTime, formatMoney } from "@/lib/format";
import { Shell } from "@/components/shared/shell";
import { Badge } from "@/components/ui/badge";
import { enabledProviders } from "@/features/billing/providers";
import { getBillingPage, type PaymentPurpose } from "@/features/billing/queries";
import { WalletTopup } from "@/features/billing/components/wallet-topup";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("billing.wallet.title"), robots: { index: false } };
}

const ICONS: Record<PaymentPurpose, typeof Wallet> = {
  vacancy_publish: Megaphone,
  worker_listing: BriefcaseBusiness,
  worker_promotion: Crown,
  ai_alerts: BellRing,
  wallet_topup: Wallet,
};
const TONES = { paid: "success", pending: "warning", unpaid: "default", cancelled: "default", failed: "destructive" } as const;

/**
 * /billing — "To'lovlarim": hamyon (balans, to'ldirish — bonus bilan) va to'lovlar tarixi (chek: xizmat, summa, usul,
 * sana, buyurtma raqami). 0063 bazada hali yo'q bo'lsa — faqat tarix va "tez orada" izohi. RLS: faqat o'z to'lovlari.
 */
export default async function BillingPage() {
  await requireSession("/billing");
  const [{ t, locale }, data] = await Promise.all([getT(), getBillingPage()]);
  const money = (n: number) => formatMoney(n, locale);

  return (
    <Shell>
      <div className="container-narrow space-y-6 py-5 sm:py-8">
        <div>
          <h1 className="text-3xl font-extrabold">{t("billing.wallet.title")}</h1>
          <p className="mt-1 text-lg text-muted-foreground">{t("billing.wallet.subtitle")}</p>
        </div>

        {data.walletState === "ready" && data.wallet ? (
          <section aria-labelledby="wallet-title" className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary" aria-hidden>
                <Wallet className="size-7" />
              </span>
              <div className="min-w-0">
                <h2 id="wallet-title" className="text-xl font-bold">
                  {t("billing.wallet.wallet_title")}
                </h2>
                <p className="text-sm text-muted-foreground">{t("billing.wallet.balance_label")}</p>
                <p className="text-4xl font-extrabold tracking-tight tabular" data-testid="wallet-balance">
                  {money(data.wallet.balance)}
                </p>
              </div>
            </div>
            <p className="text-base text-muted-foreground">{t("billing.wallet.why")}</p>
            <WalletTopup wallet={data.wallet} providers={enabledProviders()} />
            <p className="text-sm text-muted-foreground">{t("billing.wallet.note")}</p>
          </section>
        ) : data.walletState === "missing" ? (
          <p className="rounded-2xl bg-secondary p-4 text-base text-muted-foreground">{t("billing.wallet.unavailable")}</p>
        ) : null}

        <section aria-labelledby="history-title" className="space-y-3">
          <h2 id="history-title" className="text-xl font-bold">
            {t("billing.wallet.history_title")}
          </h2>
          {data.payments.length ? (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {data.payments.map((p) => {
                const Icon = ICONS[p.purpose];
                const topup = p.purpose === "wallet_topup";
                return (
                  <li key={p.id} className="flex items-start gap-3 px-4 py-3" data-testid="payment-row">
                    <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground" aria-hidden>
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-snug">{t(`billing.wallet.purposes.${p.purpose}`)}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(p.at, locale)} · {t("billing.wallet.order", { order: p.orderNo })}
                        {p.provider ? ` · ${t(`billing.wallet.methods.${p.provider}`)}` : ""}
                      </p>
                      {p.bonus > 0 ? <p className="text-sm font-semibold text-success">{t("billing.wallet.bonus", { amount: money(p.bonus) })}</p> : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={topup && p.status === "paid" ? "font-bold text-success tabular" : "font-bold tabular"}>
                        {topup && p.status === "paid" ? "+" : ""}
                        {money(p.amount)}
                      </p>
                      <Badge variant={TONES[p.status]} size="sm">
                        {t(`billing.wallet.statuses.${p.status}`)}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border p-6 text-center">
              <ReceiptText className="size-8 text-muted-foreground" aria-hidden />
              <p className="text-lg font-semibold">{t("billing.wallet.empty")}</p>
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
