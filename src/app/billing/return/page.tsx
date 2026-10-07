import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { requireSession } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { Shell } from "@/components/shared/shell";
import { Button } from "@/components/ui/button";
import { AutoRefresh } from "@/features/billing/components/auto-refresh";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("billing.return.title"), robots: { index: false } };
}

/** Payme/Click'dan qaytish: to'lov holati (RLS — faqat o'z to'lovi). Kutilayotgan bo'lsa sahifa o'zi yangilanadi */
export default async function BillingReturnPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  await requireSession("/billing/return");
  const { t, locale } = await getT();
  const { order } = await searchParams;
  const supabase = await createClient();
  const { data: p } =
    order && /^\d{1,18}$/.test(order)
      ? await supabase.from("payments").select("status, purpose, amount, vacancy_id").eq("order_no", Number(order)).maybeSingle()
      : { data: null };

  const status = p?.status ?? "not_found";
  const Icon = status === "paid" ? CheckCircle2 : status === "pending" ? Clock : XCircle;
  const tone = status === "paid" ? "bg-success-soft text-success" : status === "pending" ? "bg-primary-soft text-primary" : "bg-destructive-soft text-destructive";
  const title = status === "paid" ? t("billing.return.paid") : status === "pending" ? t("billing.return.pending") : status === "not_found" ? t("billing.return.not_found") : t("billing.return.cancelled");
  const desc =
    status === "paid"
      ? t(p?.purpose === "vacancy_publish" ? "billing.return.paid_vacancy" : p?.purpose === "ai_alerts" ? "billing.return.paid_ai_alerts" : p?.purpose === "worker_listing" ? "billing.return.paid_listing" : "billing.return.paid_promotion")
      : status === "pending"
        ? t("billing.return.pending_desc")
        : status === "not_found"
          ? ""
          : t("billing.return.cancelled_desc");

  return (
    <Shell>
      <div className="container-narrow flex min-h-[60vh] flex-col items-center justify-center py-10 text-center">
        <span className={`flex size-16 items-center justify-center rounded-full ${tone}`}>
          <Icon className="size-8" />
        </span>
        <h1 className="mt-4 text-2xl font-bold">{title}</h1>
        {desc ? <p className="mt-2 max-w-sm text-muted-foreground">{desc}</p> : null}
        {p ? <p className="mt-3 text-lg font-semibold tabular">{formatMoney(p.amount, locale)}</p> : null}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {p?.purpose === "worker_listing" ? (
            <Button asChild size="lg">
              <Link href="/profile/listing">{t("profile.listing.title")}</Link>
            </Button>
          ) : null}
          {p?.purpose === "ai_alerts" ? (
            <Button asChild size="lg">
              <Link href="/ai-alerts">{t("billing.return.to_ai_alerts")}</Link>
            </Button>
          ) : null}
          {p?.vacancy_id ? (
            <Button asChild size="lg">
              <Link href={`/employer/vacancies/${p.vacancy_id}`}>{t("billing.return.to_vacancy")}</Link>
            </Button>
          ) : null}
          <Button asChild size="lg" variant={p?.vacancy_id ? "outline" : "default"}>
            <Link href="/">{t("billing.return.to_home")}</Link>
          </Button>
        </div>
        {status === "pending" ? <AutoRefresh seconds={3} /> : null}
      </div>
    </Shell>
  );
}
