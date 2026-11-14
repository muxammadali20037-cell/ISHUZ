import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Briefcase, Check, Crown, Sparkles, UserRound } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { createPublicClient } from "@/lib/supabase/public";
import { formatDate, formatMoney } from "@/lib/format";
import { Shell } from "@/components/shared/shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { enabledProviders } from "@/features/billing/providers";
import { parseTiers } from "@/features/billing/tiers";
import type { Tier } from "@/features/billing/types";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("billing.tariffs.title"), description: t("billing.tariffs.subtitle") };
}

interface PublicTariffs {
  vacancy: Tier[];
  worker: Tier[];
  listingsPaid: boolean;
  tariffsEnabled: boolean;
  discountPercent: number;
  discountUntil: string | null;
}

/** Ochiq narxlar (0080: public_tariffs) — admin o'zgartirsa shu yerda ham o'zgaradi. Migratsiya yo'q bo'lsa — null */
async function loadTariffs(): Promise<PublicTariffs | null> {
  const { data, error } = await createPublicClient().rpc("public_tariffs");
  if (error || !data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  // ochiq sahifada to'liq narx (chegirma alohida ko'rsatiladi)
  const full = (x: unknown) => (Array.isArray(x) ? x.map((r) => ({ ...(r as object), full_price: (r as { price?: number }).price })) : null);
  const vacancy = parseTiers(full(d.vacancy));
  const worker = parseTiers(full(d.worker));
  if (!vacancy || !worker) return null;
  const until = typeof d.discount_until === "string" ? d.discount_until : null;
  const discountActive = !!until && new Date(until).getTime() > Date.now();
  return {
    vacancy,
    worker,
    listingsPaid: d.listings_paid === true,
    tariffsEnabled: d.tariffs_enabled !== false,
    discountPercent: discountActive ? Number(d.discount_percent) || 0 : 0,
    discountUntil: discountActive ? until : null,
  };
}

/**
 * "Tariflar" (ega, 2026-11-14: "tarif ko'tarilgan sari imkoniyatlar kengayib borsin, narxni baland qo'yma"):
 * ish beruvchi va ish izlovchi uchun Oddiy · Tezkor · Maksimal. Hamma son — bazadan; e'lon joylash bepul bo'lsa —
 * Oddiy "Bepul" deb ko'rsatiladi (halol). Qidirish, ariza, chat — har doim bepul.
 */
export default async function PricingPage() {
  const { t, locale } = await getT();
  const data = await loadTariffs();
  const money = (n: number) => formatMoney(n, locale);
  const online = enabledProviders().length > 0;

  const features = (kind: "vacancy" | "worker", x: Tier) =>
    [
      t(kind === "vacancy" ? "billing.tariffs.f_vacancy_days" : "billing.tariffs.f_worker_days", { days: x.days }),
      x.topDays ? t(kind === "vacancy" ? "billing.tiers.benefit_top" : "billing.tiers.benefit_top_worker", { days: x.topDays }) : null,
      x.aiDays ? t("billing.tiers.benefit_ai", { days: x.aiDays }) : null,
      t("billing.tariffs.f_channel"),
      t(kind === "vacancy" ? "billing.tariffs.f_vacancy_base" : "billing.tariffs.f_worker_base"),
    ].filter((f): f is string => !!f);

  const column = (kind: "vacancy" | "worker", tiers: Tier[]) => (
    <ul className="grid gap-3 md:grid-cols-3">
      {tiers.map((x) => {
        const free = x.plan === "basic" && !data?.listingsPaid;
        const sale = !free && data && data.discountPercent > 0 ? Math.round((x.price * (100 - data.discountPercent)) / 100 / 100) * 100 : null;
        return (
          <li
            key={x.plan}
            data-tariff={`${kind}-${x.plan}`}
            className={cn("flex flex-col rounded-2xl border bg-card p-5 shadow-sm", x.plan === "max" ? "border-primary ring-1 ring-primary" : "border-border")}
          >
            <p className="flex items-center gap-2 text-lg font-extrabold">
              {x.plan === "max" ? <Crown className="size-5 text-warning" aria-hidden /> : x.plan === "boost" ? <Sparkles className="size-5 text-primary-ink" aria-hidden /> : null}
              {t(`billing.tiers.${x.plan}`)}
            </p>
            <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
              <span className="text-3xl font-extrabold tracking-tight tabular">{free ? t("billing.tariffs.free") : money(sale ?? x.price)}</span>
              {sale ? <s className="text-base text-muted-foreground tabular">{money(x.price)}</s> : null}
            </p>
            <p className="text-sm text-muted-foreground">{free ? t("billing.tariffs.free_now") : t("billing.tariffs.per_listing", { days: x.days })}</p>
            <ul className="mt-4 flex-1 space-y-2">
              {features(kind, x).map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm leading-snug">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );

  return (
    <Shell>
      <div className="container-wide py-8 sm:py-12">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t("billing.tariffs.title")}</h1>
        <p className="mt-2 max-w-2xl text-lg text-muted-foreground">{t("billing.tariffs.subtitle")}</p>

        {!data ? (
          <p className="mt-8 rounded-2xl bg-secondary p-5 text-base">{t("billing.tariffs.unavailable")}</p>
        ) : (
          <>
            {data.discountPercent > 0 ? (
              <p className="mt-5 rounded-2xl border border-warning/30 bg-warning-soft p-4 font-semibold text-warning">
                {t("billing.tariffs.discount", { percent: data.discountPercent, date: data.discountUntil ? formatDate(data.discountUntil, locale) : "" })}
              </p>
            ) : null}
            <section aria-labelledby="tariffs-employer" className="mt-8">
              <h2 id="tariffs-employer" className="mb-3 flex items-center gap-2 text-xl font-bold">
                <Briefcase className="size-5 text-primary-ink" aria-hidden /> {t("billing.tariffs.employer")}
              </h2>
              {column("vacancy", data.vacancy)}
            </section>
            <section aria-labelledby="tariffs-worker" className="mt-10">
              <h2 id="tariffs-worker" className="mb-3 flex items-center gap-2 text-xl font-bold">
                <UserRound className="size-5 text-primary-ink" aria-hidden /> {t("billing.tariffs.worker")}
              </h2>
              {column("worker", data.worker)}
            </section>
            <ul className="mt-10 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <li className="flex items-start gap-2">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> {t("billing.tariffs.always_free")}
              </li>
              <li className="flex items-start gap-2">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> {t("billing.tariffs.how_to_buy")}
              </li>
              {!online ? (
                <li className="flex items-start gap-2 sm:col-span-2">
                  <BadgeCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /> {t("billing.tariffs.online_soon")}
                </li>
              ) : null}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/post/vacancy">{t("billing.tariffs.cta_employer")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/post/worker">{t("billing.tariffs.cta_worker")}</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
