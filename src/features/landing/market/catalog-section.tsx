import Link from "next/link";
import { ArrowRight, LayoutGrid } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getCategories } from "@/lib/reference";
import type { EntryMedia } from "@/features/entry/media";
import { categoryHref, tailSpan } from "@/features/catalog/catalog";
import { getCatalogItems } from "@/features/catalog/queries";
import { CategoryPhotoCard } from "@/features/catalog/components/category-photo-card";
import { cn } from "@/lib/utils";
import { SectionHead } from "./section-head";
import type { MarketCounts } from "./model";

/**
 * "Ommabop kasblar" — suratli katalog (egasi, 2026-11-05). Surati bor sohalar — kartalar (telefon 2, planshet 3, kompyuter 4
 * ustun); qolganlari — oxirgi "Boshqa kasblar" kartasida nomlari bilan (har biri o'z sohasiga havola) va /kasblar sahifasiga.
 * Sonlar — bazadan (xato bo'lsa ko'rsatilmaydi). Hech bir surat bo'lmasa ham bo'lim ishlaydi: faqat "Boshqa kasblar" kartasi.
 * `embedded` — ish qidiruvchi bosh sahifasi ichida (o'z konteyneri va katta oraliqlarsiz, ixcham sarlavha).
 */
export async function PhotoCatalog({ media, counts, embedded = false }: { media: EntryMedia; counts: MarketCounts | null; embedded?: boolean }) {
  const [{ t }, items, categories] = await Promise.all([getT(), getCatalogItems(media, counts), getCategories()]);
  if (!items.length) return null;
  const withPhoto = items.filter((i) => i.photo);
  const without = items.filter((i) => !i.photo);
  // katalogdagi 14 sohadan tashqari yana nechta soha bor (ma'lumotnomadagi faollari)
  const more = Math.max(0, categories.length - items.length);
  const tail = tailSpan(withPhoto.length);
  const countLabel = (count: string) => t("welcome.market.cat_count", { count });
  return (
    <section id="sohalar" aria-labelledby="home-categories" className={embedded ? "scroll-mt-20" : "container-app scroll-mt-20 py-10 sm:py-14"}>
      <SectionHead
        id="home-categories"
        compact={embedded}
        title={t("welcome.catalog.title")}
        subtitle={t("welcome.catalog.subtitle")}
        action={
          <Link href="/kasblar" className="inline-flex min-h-11 items-center gap-1.5 text-md font-semibold text-primary-ink hover:underline">
            {t("welcome.catalog.all")}
            <ArrowRight className="size-4.5" aria-hidden />
          </Link>
        }
      />
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {withPhoto.map((item, i) => (
          <li key={item.key} className="flex">
            <CategoryPhotoCard item={item} countLabel={countLabel} sizes="(min-width: 1024px) 280px, (min-width: 768px) 30vw, 50vw" priority={i < 2} />
          </li>
        ))}
        <li className={cn("flex", tail.cls)}>
          <div className="flex w-full flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-ink" aria-hidden>
                <LayoutGrid className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-semibold leading-snug">{t("welcome.catalog.other_title")}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {more > 0 ? t("welcome.catalog.other_desc", { count: more }) : t("welcome.catalog.other_desc_plain")}
                </p>
              </div>
              {/* keng kartada (qatorni to'ldirganda) — sarlavha yonida; tor kartada — pastda */}
              <Link
                href="/kasblar"
                className={cn(
                  "min-h-11 items-center gap-1.5 text-md font-semibold text-primary-ink hover:underline",
                  tail.wide.base ? "inline-flex" : "hidden",
                  tail.wide.md ? "md:inline-flex" : "md:hidden",
                  tail.wide.lg ? "lg:inline-flex" : "lg:hidden",
                )}
              >
                {t("welcome.catalog.all")}
                <ArrowRight className="size-4.5" aria-hidden />
              </Link>
            </div>
            {without.length ? (
              <ul className="flex flex-wrap gap-2" aria-label={t("welcome.catalog.other_title")}>
                {without.map((item) => (
                  <li key={item.key} className="flex">
                    <Link
                      href={categoryHref(item.slug)}
                      prefetch={false}
                      data-track="home_category"
                      data-track-to={item.slug}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-background px-3.5 text-sm font-medium text-foreground hover:border-primary/50 hover:text-primary-ink"
                    >
                      {item.label}
                      {item.count ? <span className="text-muted-foreground">{item.count}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
            <Link
              href="/kasblar"
              className={cn(
                "mt-auto min-h-11 items-center gap-1.5 self-start text-md font-semibold text-primary-ink hover:underline",
                tail.wide.base ? "hidden" : "inline-flex",
                tail.wide.md ? "md:hidden" : "md:inline-flex",
                tail.wide.lg ? "lg:hidden" : "lg:inline-flex",
              )}
            >
              {t("welcome.catalog.all")}
              <ArrowRight className="size-4.5" aria-hidden />
            </Link>
          </div>
        </li>
      </ul>
    </section>
  );
}
