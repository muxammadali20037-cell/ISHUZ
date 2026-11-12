import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getRegions } from "@/lib/reference";
import { MastersShell } from "@/features/masters/components/masters-shell";
import { MastersUnavailable } from "@/features/masters/components/masters-unavailable";
import { CategoryIcon } from "@/features/masters/components/category-icon";
import { MasterCard } from "@/features/masters/components/master-card";
import { getMasterCategories, searchMasters } from "@/features/masters/queries";
import { masterSearchHref, parseMasterSearch } from "@/features/masters/schema";
import { MASTER_PAGE_SIZE } from "@/features/masters/types";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const [{ t, name }, p, categories] = await Promise.all([
    getT(),
    searchParams.then(parseMasterSearch),
    getMasterCategories(),
  ]);
  const c = p.category ? categories.find((x) => x.slug === p.category) : null;
  return {
    title: `${c ? name(c) : t("masters.results.title")} · ${t("masters.name")}`,
    robots:
      p.q || p.region || p.exp || p.page > 1
        ? { index: false, follow: true }
        : undefined,
  };
}

/** /ustalar/qidiruv — kategoriya chiplari, hudud, tajriba, tartib (oddiy GET forma — JS'siz ishlaydi), kartalar, sahifalash */
export default async function MastersSearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const p = parseMasterSearch(await searchParams);
  const [{ t, name }, categories, regions] = await Promise.all([
    getT(),
    getMasterCategories(),
    getRegions(),
  ]);
  // 0076 hali qo'llanmagan baza: filtrlar va "0 ta e'lon" emas — bosh sahifadagi kabi halol holat
  if (!categories.length) return <MastersUnavailable />;
  const result = await searchMasters(p);
  const current = p.category
    ? (categories.find((c) => c.slug === p.category) ?? null)
    : null;
  const pageCount = result
    ? Math.max(1, Math.ceil(result.total / MASTER_PAGE_SIZE))
    : 1;
  const chip = (active: boolean) =>
    cn(
      "press inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold",
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-card hover:border-primary/50",
    );

  return (
    <MastersShell>
      <div className="container-wide space-y-5 py-4 sm:py-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            {current ? (
              <CategoryIcon
                icon={current.icon}
                className="size-7 text-primary-ink"
              />
            ) : null}
            {current ? name(current) : t("masters.results.title")}
          </h1>
          {result ? (
            <p className="mt-1 text-muted-foreground">
              {t("masters.results.found", { count: result.total })}
            </p>
          ) : null}
        </div>

        {/* kategoriya chiplari: gorizontal, telefonda suriladi */}
        <ul
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:thin] sm:mx-0 sm:flex-wrap sm:px-0"
          aria-label={t("masters.results.category")}
          data-masters-chips
        >
          <li>
            <Link
              href={masterSearchHref({ ...p, category: "", page: 1 })}
              className={chip(!p.category)}
            >
              {t("masters.results.all_categories")}
            </Link>
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                href={masterSearchHref({ ...p, category: c.slug, page: 1 })}
                className={chip(p.category === c.slug)}
                aria-current={p.category === c.slug ? "page" : undefined}
              >
                <CategoryIcon icon={c.icon} className="size-4" /> {name(c)}
              </Link>
            </li>
          ))}
        </ul>

        <form
          method="get"
          action="/ustalar/qidiruv"
          className="grid gap-2 rounded-2xl border border-border bg-card p-3 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end"
          data-masters-filters
        >
          {p.category ? (
            <input type="hidden" name="k" value={p.category} />
          ) : null}
          <label className="grid gap-1 text-sm font-semibold">
            {t("masters.search_label")}
            <span className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                name="q"
                type="search"
                defaultValue={p.q}
                placeholder={t("masters.search_placeholder")}
                className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-3 text-base font-normal outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
              />
            </span>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            {t("masters.results.region")}
            <select
              name="region"
              defaultValue={p.region}
              className="h-11 rounded-xl border border-input bg-background px-3 text-base font-normal"
            >
              <option value="">{t("masters.results.all_regions")}</option>
              {regions.map((r) => (
                <option key={r.id} value={r.slug}>
                  {name(r)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            {t("masters.results.experience")}
            <select
              name="exp"
              defaultValue={String(p.exp || "")}
              className="h-11 rounded-xl border border-input bg-background px-3 text-base font-normal"
            >
              <option value="">{t("masters.results.exp_any")}</option>
              <option value="1">{t("masters.results.exp_1")}</option>
              <option value="3">{t("masters.results.exp_3")}</option>
              <option value="5">{t("masters.results.exp_5")}</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            {t("masters.results.sort")}
            <select
              name="sort"
              defaultValue={p.sort}
              className="h-11 rounded-xl border border-input bg-background px-3 text-base font-normal"
            >
              <option value="new">{t("masters.results.sort_new")}</option>
              <option value="rating">{t("masters.results.sort_rating")}</option>
              <option value="experience">
                {t("masters.results.sort_experience")}
              </option>
            </select>
          </label>
          <Button type="submit" className="h-11 text-base">
            <SlidersHorizontal className="size-4" aria-hidden />{" "}
            {t("masters.results.apply")}
          </Button>
        </form>

        {!result ? (
          <EmptyState
            title={t("easy.start.list_error_title")}
            description={t("easy.start.list_error_desc")}
          />
        ) : result.items.length ? (
          <>
            <ul
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-6"
              data-masters-results
            >
              {result.items.map((m, i) => (
                <li key={m.id} className="flex">
                  <MasterCard m={m} priority={i < 4} />
                </li>
              ))}
            </ul>
            {result.items.some((m) => m.is_demo) ? (
              <p className="rounded-xl border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                {t("masters.demo_note")}
              </p>
            ) : null}
            {pageCount > 1 ? (
              <nav
                className="flex items-center justify-between gap-3"
                aria-label={t("masters.results.page", { page: p.page })}
              >
                <Button
                  asChild
                  variant="outline"
                  disabled={p.page <= 1}
                  className="h-11 bg-card text-base"
                >
                  <Link
                    href={masterSearchHref({
                      ...p,
                      page: Math.max(1, p.page - 1),
                    })}
                    aria-disabled={p.page <= 1}
                  >
                    <ChevronLeft className="size-4" aria-hidden />{" "}
                    {t("masters.results.prev")}
                  </Link>
                </Button>
                <span className="text-sm font-semibold text-muted-foreground">
                  {p.page} / {pageCount}
                </span>
                <Button
                  asChild
                  variant="outline"
                  disabled={p.page >= pageCount}
                  className="h-11 bg-card text-base"
                >
                  <Link
                    href={masterSearchHref({
                      ...p,
                      page: Math.min(pageCount, p.page + 1),
                    })}
                    aria-disabled={p.page >= pageCount}
                  >
                    {t("masters.results.next")}{" "}
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                </Button>
              </nav>
            ) : null}
          </>
        ) : (
          <EmptyState
            title={t("masters.results.empty_title")}
            description={t("masters.results.empty_desc")}
            action={{ label: t("masters.post"), href: "/ustalar/elon" }}
          />
        )}
      </div>
    </MastersShell>
  );
}
