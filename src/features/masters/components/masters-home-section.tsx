import Link from "next/link";
import { ArrowRight, LayoutGrid, Wrench } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";
import { getMasterCategories } from "../queries";
import { masterSearchHref } from "../schema";
import { CategoryIcon } from "./category-icon";

/** bosh sahifada ko'rsatiladigan xizmat turlari soni (qolgani — "Barcha xizmatlar") */
const SHOWN = 7;

/**
 * Bosh sahifadagi "Universal ustalar" bo'limi (ega, 2026-11-13: "Universal ustalar oddiy ish e'lonlari bilan aralashib ketmasin —
 * alohida rang, alohida dizayn"). O'z yashil mavzusida (`theme-masters`), ish e'lonlaridan keyin: xizmat turlari (haqiqiy
 * katalogdan, tartib bo'yicha) va "Ustalarni ko'rish". Katalog yuklanmasa — faqat sarlavha va tugma.
 */
export async function MastersHomeSection() {
  const [{ t, name }, categories] = await Promise.all([getT(), getMasterCategories()]);
  const shown = categories.slice(0, SHOWN);
  return (
    <section aria-labelledby="masters-home-title" data-masters-home className="theme-masters rounded-2xl border border-primary/30 bg-primary-soft p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground" aria-hidden>
          <Wrench className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id="masters-home-title" className="text-lg font-bold leading-tight text-primary-ink sm:text-xl">
            {t("masters.name")}
          </h2>
          <p className="mt-0.5 text-sm text-foreground/80 sm:text-base">{t("masters.home.desc")}</p>
        </div>
      </div>
      {shown.length ? (
        <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 2xl:grid-cols-8" aria-label={t("masters.categories_title")}>
          {shown.map((c) => (
            <li key={c.id} className="flex">
              <Link
                href={masterSearchHref({ category: c.slug })}
                prefetch={false}
                data-track="masters_entry"
                data-track-to={c.slug}
                className="press flex min-h-12 w-full items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold hover:border-primary/60"
              >
                <CategoryIcon icon={c.icon} className="size-5 shrink-0 text-primary-ink" />
                <span className="min-w-0 leading-tight">{name(c)}</span>
              </Link>
            </li>
          ))}
          <li className="flex">
            <Link
              href="/ustalar"
              prefetch={false}
              className="press flex min-h-12 w-full items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-primary-ink hover:border-primary/60"
            >
              <LayoutGrid className="size-5 shrink-0" aria-hidden />
              <span className="min-w-0 leading-tight">{t("masters.home.all")}</span>
            </Link>
          </li>
        </ul>
      ) : null}
      <Button asChild size="lg" className="mt-4 w-full text-base font-bold sm:w-auto">
        <Link href="/ustalar" data-masters-entry data-track="masters_entry" data-track-to="home">
          {t("masters.home.open")} <ArrowRight className="size-5" aria-hidden />
        </Link>
      </Button>
    </section>
  );
}
