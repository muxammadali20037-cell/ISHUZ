import { billingEnabled } from "@/lib/features";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BadgeCheck, Crown, Megaphone, Search } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";
import { Shell } from "@/components/shared/shell";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("billing.pricing.title"), description: t("billing.pricing.subtitle") };
}

/** Ochiq narxlar sahifasi — qiymatlar app_settings'dan (admin o'zgartirsa shu yerda ham o'zgaradi) */
export default async function PricingPage() {
  if (!billingEnabled()) notFound();
  const { t, locale } = await getT();
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["billing_free_until", "price_vacancy_publish", "price_worker_promotion", "free_vacancy_hours", "promotion_hours", "vacancy_lifetime_days"]);
  const get = (k: string) => data?.find((r) => r.key === k)?.value;
  const int = (k: string, d: number) => Number(get(k) ?? d) || d;
  const promoUntil = typeof get("billing_free_until") === "string" ? (get("billing_free_until") as string) : null;
  const promo = !!promoUntil && new Date(promoUntil).getTime() > new Date().getTime();

  const rows = [
    { icon: Megaphone, title: t("billing.pricing.vacancy"), note: t("billing.pricing.vacancy_note", { days: int("vacancy_lifetime_days", 30) }), extra: t("billing.pricing.vacancy_free", { hours: int("free_vacancy_hours", 24) }), price: formatMoney(int("price_vacancy_publish", 50000), locale) },
    { icon: Crown, title: t("billing.pricing.top"), note: t("billing.pricing.top_note", { hours: int("promotion_hours", 24) }), extra: t("billing.pricing.top_free"), price: formatMoney(int("price_worker_promotion", 20000), locale) },
    { icon: Search, title: t("billing.pricing.search"), note: t("billing.pricing.search_note"), extra: null, price: t("billing.pricing.free") },
  ];

  return (
    <Shell>
      <div className="container-narrow py-8 sm:py-12">
        <h1 className="text-3xl font-extrabold tracking-tight">{t("billing.pricing.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("billing.pricing.subtitle")}</p>
        {promo ? <p className="mt-5 rounded-2xl bg-success-soft p-4 font-semibold text-success">{t("billing.pricing.promo_banner", { date: formatDate(promoUntil, locale) })}</p> : null}
        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <li key={r.title} className="flex items-start gap-4 rounded-2xl border border-border bg-card p-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <r.icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{r.title}</p>
                <p className="text-sm text-muted-foreground">{r.note}</p>
                {r.extra ? (
                  <p className="mt-1 flex items-center gap-1 text-sm font-medium text-success">
                    <BadgeCheck className="size-4" />
                    {r.extra}
                  </p>
                ) : null}
              </div>
              <span className={promo && r.extra ? "shrink-0 text-right font-bold tabular text-muted-foreground line-through" : "shrink-0 text-right font-bold tabular"}>{r.price}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted-foreground">
          {t("billing.pricing.methods")}: <span className="font-semibold text-foreground">Payme · Click</span>
        </p>
      </div>
    </Shell>
  );
}
