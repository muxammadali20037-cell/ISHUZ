import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { DEFAULT_OG_IMAGE, localeAlternates } from "@/lib/seo";
import { getCategories } from "@/lib/reference";
import { Shell } from "@/components/shared/shell";
import { CategoryIcon } from "@/components/shared/category-icon";
import { getEntryMedia } from "@/features/entry/queries";
import { getMarketCounts } from "@/features/landing/market/queries";
import { SiteFooter } from "@/features/landing/market/site-footer";
import { categoryHref } from "@/features/catalog/catalog";
import { getCatalogItems } from "@/features/catalog/queries";
import { CategoryPhotoCard } from "@/features/catalog/components/category-photo-card";
import { cn } from "@/lib/utils";

const num = (n: number) => new Intl.NumberFormat("ru-RU").format(n);

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  const title = t("welcome.catalog.page_title");
  const description = t("welcome.catalog.page_meta");
  return { title, description, alternates: localeAlternates("/kasblar", locale), openGraph: { title, description, url: "/kasblar", images: [DEFAULT_OG_IMAGE] } };
}

/**
 * /kasblar — kasblar katalogi (egasi, 2026-11-05): yuqorida suratli kartalar (katalogdagi, surati borlari), ostida ma'lumotnomadagi
 * barcha faol sohalar (son — hozirgi faol vakansiyalar; ko'pi birinchi, e'loni yo'qlari oxirida). Har biri — /jobs?category=…
 * Ro'yxatdan o'tish shart emas. Sonlar xato bo'lsa — ko'rsatilmaydi (soxta raqam yo'q), ro'yxat baribir ishlaydi.
 */
export default async function CatalogPage() {
  const [{ t, name }, media, counts, categories] = await Promise.all([getT(), getEntryMedia(), getMarketCounts(), getCategories()]);
  const items = (await getCatalogItems(media, counts)).filter((i) => i.photo);
  const countOf = (id: string) => (counts ? (counts.categories[id] ?? 0) : null);
  const all = [...categories].sort((a, b) => (countOf(b.id) ?? 0) - (countOf(a.id) ?? 0) || a.sort_order - b.sort_order);
  const countLabel = (count: string) => t("welcome.market.cat_count", { count });
  return (
    <Shell footer={<SiteFooter />}>
      <div className="container-app py-8 sm:py-12">
        <header className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("welcome.catalog.page_title")}</h1>
          <p className="mt-2 text-lg leading-relaxed text-muted-foreground">{t("welcome.catalog.page_subtitle")}</p>
        </header>

        {items.length ? (
          <ul className={cn("mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3", items.length % 3 === 0 && items.length < 12 ? "lg:grid-cols-3" : "lg:grid-cols-4")}>
            {items.map((item, i) => (
              <li key={item.key} className="flex">
                <CategoryPhotoCard item={item} countLabel={countLabel} sizes="(min-width: 1024px) 380px, (min-width: 768px) 30vw, 50vw" priority={i < 4} />
              </li>
            ))}
          </ul>
        ) : null}

        <section aria-labelledby="all-fields" className="mt-12">
          <h2 id="all-fields" className="text-2xl font-semibold tracking-tight">
            {t("welcome.catalog.page_all_title")}
          </h2>
          <ul className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {all.map((c) => {
              const n = countOf(c.id);
              return (
                <li key={c.id} className="flex">
                  <Link
                    href={categoryHref(c.slug)}
                    prefetch={false}
                    data-track="catalog_category"
                    data-track-to={c.slug}
                    className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40 sm:p-4"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary" aria-hidden>
                      <CategoryIcon name={c.icon} className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-medium leading-snug">{name(c)}</span>
                      {n !== null ? (
                        <span className="mt-0.5 block text-sm text-muted-foreground">{n > 0 ? countLabel(num(n)) : t("welcome.catalog.no_jobs")}</span>
                      ) : null}
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </Shell>
  );
}
