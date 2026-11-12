import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Search, ShieldCheck, Star, Timer } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { localeAlternates } from "@/lib/seo";
import { MastersShell } from "@/features/masters/components/masters-shell";
import { MastersUnavailable } from "@/features/masters/components/masters-unavailable";
import { CategoryIcon } from "@/features/masters/components/category-icon";
import { MasterCard } from "@/features/masters/components/master-card";
import {
  getMasterCategories,
  getMasterCategoryCounts,
  searchMasters,
} from "@/features/masters/queries";
import { masterSearchHref } from "@/features/masters/schema";
import { EmptyState } from "@/components/ui/misc";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return {
    title: t("masters.meta_title"),
    description: t("masters.meta_description"),
    alternates: localeAlternates("/ustalar", locale),
  };
}

/**
 * /ustalar — "Universal ustalar" bosh sahifasi: sarlavha (turkuaz), qidiruv, 12 ta xizmat kategoriyasi (haqiqiy sonlar bilan),
 * eng ko'p e'lonli kategoriyalar bo'yicha 4 tadan karta, "E'lon joylash". Demo e'lonlar "Demo" belgisi bilan; haqiqiylari avval.
 */
export default async function MastersHomePage() {
  const [{ t, name }, categories, counts] = await Promise.all([
    getT(),
    getMasterCategories(),
    getMasterCategoryCounts(),
  ]);
  const withCount = categories.map((c) => ({
    c,
    n: counts?.[c.id]?.active ?? 0,
    real: counts?.[c.id]?.real ?? 0,
  }));
  const featured = [...withCount]
    .filter((x) => x.n > 0)
    .sort((a, b) => b.real - a.real || b.n - a.n)
    .slice(0, 3);
  const sections = await Promise.all(
    featured.map(async (f) => ({
      ...f,
      result: await searchMasters({ category: f.c.slug, limit: 4 }),
    })),
  );
  const anyDemo = sections.some((s) => s.result?.items.some((m) => m.is_demo));

  // 0076 hali qo'llanmagan baza (deploy oynasi): buzilgan katalog emas — halol "tayyorlanmoqda" holati
  if (!categories.length) return <MastersUnavailable />;

  return (
    <MastersShell>
      <div className="container-app space-y-8 py-4 sm:py-6">
        <section
          className="relative overflow-hidden rounded-2xl bg-primary px-5 py-7 text-primary-foreground sm:px-8 sm:py-10"
          data-masters-hero
        >
          <div className="relative max-w-2xl">
            <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t("masters.name")}
            </h1>
            <p className="mt-2 text-lg text-primary-foreground/90 sm:text-xl">
              {t("masters.tagline")}
            </p>
            <form
              action="/ustalar/qidiruv"
              method="get"
              role="search"
              className="mt-5 flex gap-2"
            >
              <label htmlFor="masters-hero-q" className="sr-only">
                {t("masters.search_label")}
              </label>
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <input
                  id="masters-hero-q"
                  name="q"
                  type="search"
                  placeholder={t("masters.search_placeholder")}
                  className="h-12 w-full rounded-xl border-0 bg-card pl-10 pr-3 text-base text-foreground outline-none ring-2 ring-transparent focus:ring-card/60"
                />
              </div>
              <button
                type="submit"
                className="press h-12 shrink-0 rounded-xl bg-card px-4 text-base font-bold text-primary-ink hover:bg-primary-soft"
              >
                {t("masters.search")}
              </button>
            </form>
            <ul className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
              {[
                [Timer, t("masters.badges.fast")],
                [ShieldCheck, t("masters.badges.moderated")],
                [Star, t("masters.badges.reviews")],
              ].map(([Icon, label]) => {
                const I = Icon as typeof Timer;
                return (
                  <li
                    key={String(label)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary-hover px-3 py-1.5"
                  >
                    <I className="size-4" aria-hidden /> {String(label)}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section aria-labelledby="masters-cats">
          <h2 id="masters-cats" className="text-xl font-bold">
            {t("masters.categories_title")}
          </h2>
          <ul
            className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
            data-masters-categories
          >
            {withCount.map(({ c, n }) => (
              <li key={c.id} className="flex">
                <Link
                  href={masterSearchHref({ category: c.slug })}
                  className="press flex w-full flex-col gap-2 rounded-2xl border border-border bg-card p-3.5 hover:border-primary/50"
                  data-category={c.slug}
                >
                  <span
                    className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary-ink"
                    aria-hidden
                  >
                    <CategoryIcon icon={c.icon} />
                  </span>
                  <span className="text-base font-bold leading-snug">
                    {name(c)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {n
                      ? t("masters.count", { count: n })
                      : t("masters.count_none")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {sections.length ? (
          sections.map((s) => (
            <section
              key={s.c.id}
              aria-labelledby={`masters-sec-${s.c.slug}`}
              data-masters-section={s.c.slug}
            >
              <div className="flex items-end justify-between gap-3">
                <h2
                  id={`masters-sec-${s.c.slug}`}
                  className="flex items-center gap-2 text-xl font-bold"
                >
                  <CategoryIcon
                    icon={s.c.icon}
                    className="size-6 text-primary-ink"
                  />{" "}
                  {name(s.c)}
                </h2>
                <Link
                  href={masterSearchHref({ category: s.c.slug })}
                  className="-my-2 inline-flex min-h-11 items-center gap-1 text-base font-semibold text-primary-ink hover:underline"
                >
                  {t("masters.see_all")}{" "}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
              {s.result ? (
                <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {s.result.items.map((m, i) => (
                    <li key={m.id} className="flex">
                      <MasterCard m={m} priority={i < 2} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-muted-foreground">
                  {t("easy.start.list_error_desc")}
                </p>
              )}
            </section>
          ))
        ) : (
          <EmptyState
            title={t("masters.results.empty_title")}
            description={t("masters.results.empty_desc")}
          />
        )}

        {anyDemo ? (
          <p
            className="rounded-xl border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground"
            data-masters-demo-note
          >
            {t("masters.demo_note")}
          </p>
        ) : null}
      </div>
    </MastersShell>
  );
}
