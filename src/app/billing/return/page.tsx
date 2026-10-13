import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { requireSession } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney } from "@/lib/format";
import { Shell } from "@/components/shared/shell";
import { Button } from "@/components/ui/button";
import { AutoRefresh } from "@/features/billing/components/auto-refresh";
import { RetryPay } from "@/features/billing/components/retry-pay";
import type { CheckoutPurpose } from "@/features/billing/types";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("billing.return.title"), robots: { index: false } };
}

const PAID_DESC = {
  vacancy_publish: "billing.return.paid_vacancy",
  ai_alerts: "billing.return.paid_ai_alerts",
  worker_listing: "billing.return.paid_listing",
  worker_promotion: "billing.return.paid_promotion",
} as const;

/**
 * Payme/Click'dan (yoki balansdan to'lovdan) qaytish: holat, to'langan bo'lsa — chek (xizmat, summa, usul, sana, buyurtma),
 * bekor bo'lsa — "Qayta to'lash" (shu xizmatning to'lov oynasi). RLS — faqat o'z to'lovi. Kutilayotgan bo'lsa sahifa o'zi yangilanadi.
 */
export default async function BillingReturnPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  await requireSession("/billing/return");
  const { t, locale } = await getT();
  const { order } = await searchParams;
  const supabase = await createClient();
  const { data: p } =
    order && /^\d{1,18}$/.test(order)
      ? await supabase
          .from("payments")
          .select("id, order_no, status, purpose, amount, provider, vacancy_id, worker_id, created_at, paid_at")
          .eq("order_no", Number(order))
          .maybeSingle()
      : { data: null };

  const status = p?.status ?? "not_found";
  const topup = p?.purpose === "wallet_topup";
  let bonus = 0;
  if (p && topup && status === "paid") {
    // 0063 bo'lmasa jadval yo'q — bonus ko'rsatilmaydi
    const { data } = await supabase.from("wallet_ledger").select("delta").eq("payment_id", p.id).eq("kind", "bonus");
    bonus = (data ?? []).reduce((s, r) => s + r.delta, 0);
  }
  const money = (n: number) => formatMoney(n, locale);
  const Icon = status === "paid" ? CheckCircle2 : status === "pending" ? Clock : XCircle;
  const tone = status === "paid" ? "bg-success-soft text-success" : status === "pending" ? "bg-primary-soft text-primary" : "bg-destructive-soft text-destructive";
  const title =
    status === "paid"
      ? topup
        ? t("billing.return.paid_topup")
        : t("billing.return.paid")
      : status === "pending"
        ? t("billing.return.pending")
        : status === "not_found"
          ? t("billing.return.not_found")
          : t("billing.return.cancelled");
  const desc =
    status === "paid"
      ? topup
        ? bonus > 0
          ? t("billing.return.paid_topup_bonus", { amount: money(p!.amount), bonus: money(bonus) })
          : t("billing.return.paid_topup_desc", { amount: money(p!.amount) })
        : t(PAID_DESC[p!.purpose as keyof typeof PAID_DESC] ?? "billing.return.paid_promotion")
      : status === "pending"
        ? t("billing.return.pending_desc")
        : status === "not_found"
          ? ""
          : t("billing.return.cancelled_desc");

  // keyingi qadam: xizmatning o'z sahifasi
  const next = !p
    ? null
    : p.purpose === "worker_listing"
      ? { href: "/profile/listing", label: t("profile.listing.title") }
      : p.purpose === "ai_alerts"
        ? { href: "/ai-alerts", label: t("billing.return.to_ai_alerts") }
        : p.purpose === "wallet_topup"
          ? { href: "/billing", label: t("billing.return.to_wallet") }
          : p.vacancy_id
            ? { href: `/employer/vacancies/${p.vacancy_id}`, label: t("billing.return.to_vacancy") }
            : null;
  const failed = status === "cancelled" || status === "failed";
  const retryTarget = p?.purpose === "vacancy_publish" ? p.vacancy_id : p?.purpose === "ai_alerts" ? null : p?.worker_id ?? null;
  const canRetry = !!p && failed && p.purpose !== "wallet_topup" && (p.purpose === "ai_alerts" || !!retryTarget);

  return (
    <Shell>
      <div className="container-narrow flex min-h-[60vh] flex-col items-center justify-center py-10 text-center">
        <span className={`flex size-16 items-center justify-center rounded-full ${tone}`}>
          <Icon className="size-8" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-bold">{title}</h1>
        {desc ? <p className="mt-2 max-w-sm text-muted-foreground">{desc}</p> : null}
        {p && status !== "paid" ? <p className="mt-3 text-lg font-semibold tabular">{money(p.amount)}</p> : null}

        {p && status === "paid" ? (
          <section aria-labelledby="receipt-title" className="mt-5 w-full max-w-sm rounded-2xl border border-border bg-card p-4 text-left">
            <h2 id="receipt-title" className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {t("billing.return.receipt_title")}
            </h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">{t("billing.return.receipt_service")}</dt>
              <dd className="text-right font-semibold">{t(`billing.wallet.purposes.${p.purpose}`)}</dd>
              <dt className="text-muted-foreground">{t("billing.return.receipt_amount")}</dt>
              <dd className="text-right font-semibold tabular">{money(p.amount)}</dd>
              {p.provider ? (
                <>
                  <dt className="text-muted-foreground">{t("billing.return.receipt_method")}</dt>
                  <dd className="text-right font-semibold">{t(`billing.wallet.methods.${p.provider}`)}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">{t("billing.return.receipt_date")}</dt>
              <dd className="text-right font-semibold">{formatDateTime(p.paid_at ?? p.created_at, locale)}</dd>
              <dt className="text-muted-foreground">{t("billing.return.receipt_order")}</dt>
              <dd className="text-right font-mono font-semibold tabular">{t("billing.wallet.order", { order: p.order_no })}</dd>
            </dl>
          </section>
        ) : null}

        <div className="mt-6 flex w-full max-w-sm flex-col gap-2">
          {canRetry ? <RetryPay purpose={p!.purpose as CheckoutPurpose} targetId={retryTarget} label={t("billing.return.retry")} /> : null}
          {failed && topup ? (
            <Button asChild size="lg">
              <Link href="/billing">{t("billing.return.retry")}</Link>
            </Button>
          ) : null}
          {next && !(failed && topup) ? (
            <Button asChild size="lg" variant={failed ? "outline" : "default"}>
              <Link href={next.href}>{next.label}</Link>
            </Button>
          ) : null}
          <Button asChild size="lg" variant={next || failed ? "outline" : "default"}>
            <Link href="/">{t("billing.return.to_home")}</Link>
          </Button>
          {p && status === "paid" ? (
            <Link href="/billing" className="mt-1 inline-flex min-h-11 items-center justify-center font-semibold text-primary underline-offset-4 hover:underline">
              {t("billing.checkout.history_link")}
            </Link>
          ) : null}
        </div>
        {status === "pending" ? <AutoRefresh seconds={3} /> : null}
      </div>
    </Shell>
  );
}
