import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getCategories } from "@/lib/reference";
import { Shell } from "@/components/shared/shell";
import { CategoryIcon } from "@/components/shared/category-icon";
import { TINT_TILE, tintAt } from "@/components/shared/tints";
import { getMarketCounts } from "@/features/landing/market/queries";
import { categoryHref } from "@/features/catalog/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("easy.sohalar.title"), alternates: { canonical: "/kasblar" } };
}

const num = (n: number) => new Intl.NumberFormat("ru-RU").format(n);

/**
 * /sohalar — barcha sohalar bir qatordan (ega, 2026-11-17: "xabarlar o'rniga sohalar — har bir soha qator bo'lib tursin, eng ko'p
 * ish o'rni bor soha tepada, har birining tagida kichkina yozuv bilan nechta ish o'rni borligi; hisobga kirmaganlarga").
 * Son — hozirgi faol vakansiyalar (haqiqiy); xato bo'lsa sonlar ko'rsatilmaydi (soxta raqam yo'q), ro'yxat baribir ishlaydi.
 * Har biri — shu sohadagi ishlar (/jobs?category=…).
 */
export default async function FieldsPage() {
  const [{ t, name }, counts, categories] = await Promise.all([getT(), getMarketCounts(), getCategories()]);
  const countOf = (id: string) => (counts ? (counts.categories[id] ?? 0) : null);
  const all = [...categories].sort((a, b) => (countOf(b.id) ?? 0) - (countOf(a.id) ?? 0) || a.sort_order - b.sort_order);
  return (
    <Shell>
      <div className="container-narrow py-5 sm:py-8">
        <h1 className="text-page font-extrabold tracking-tight sm:text-page-lg">{t("easy.sohalar.title")}</h1>
        <p className="mt-1 text-base text-muted-foreground">{t("easy.sohalar.subtitle")}</p>
        {counts ? null : (
          <p className="mt-3 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm" role="status">
            {t("easy.sohalar.error")}
          </p>
        )}
        <ul className="mt-5 divide-y divide-border overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm" data-fields>
          {all.map((c, i) => {
            const n = countOf(c.id);
            return (
              <li key={c.id}>
                <Link
                  href={categoryHref(c.slug)}
                  prefetch={false}
                  data-track="catalog_category"
                  data-track-to={c.slug}
                  data-field={c.slug}
                  className="press flex min-h-16 items-center gap-3 px-4 py-2.5 hover:bg-secondary/60"
                >
                  <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${TINT_TILE[tintAt(i)]}`} aria-hidden>
                    <CategoryIcon name={c.icon} className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-bold leading-tight [overflow-wrap:anywhere]">{name(c)}</span>
                    {n !== null ? (
                      <span className="mt-0.5 block text-sm text-muted-foreground" data-field-count={n}>
                        {n > 0 ? t("easy.sohalar.count", { count: num(n) }) : t("easy.sohalar.none")}
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </Shell>
  );
}
