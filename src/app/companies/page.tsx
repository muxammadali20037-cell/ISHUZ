import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Building2, ChevronLeft, ChevronRight, Landmark, MapPin, Search } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { localeAlternates } from "@/lib/seo";
import { getCategories, getRegions } from "@/lib/reference";
import { Shell } from "@/components/shared/shell";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { COMPANIES_PAGE_SIZE, getDirectoryCompanies } from "@/features/companies/queries";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function parse(sp: Record<string, string | string[] | undefined>) {
  const q = one(sp.q).replace(/\s+/g, " ").trim().slice(0, 80);
  const region = /^[a-z0-9_-]{1,64}$/.test(one(sp.region)) ? one(sp.region) : "";
  const page = Math.min(Math.max(Number.parseInt(one(sp.page), 10) || 1, 1), 200);
  return { q, region, page };
}

function href(p: { q: string; region: string; page: number }): string {
  const sp = new URLSearchParams();
  if (p.q) sp.set("q", p.q);
  if (p.region) sp.set("region", p.region);
  if (p.page > 1) sp.set("page", String(p.page));
  const qs = sp.toString();
  return qs ? `/companies?${qs}` : "/companies";
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const [{ t, locale }, p] = await Promise.all([getT(), searchParams.then(parse)]);
  return {
    title: t("welcome.companies.meta_title"),
    description: t("welcome.companies.meta_description"),
    alternates: localeAlternates("/companies", locale),
    // qidiruv va sahifalar varianti indekslanmaydi — faqat asosiy ro'yxat
    robots: p.q || p.region || p.page > 1 ? { index: false, follow: true } : undefined,
  };
}

/**
 * /companies — "Kompaniyalar": hozir xodim qidirayotgan haqiqiy kompaniyalar (faol vakansiyasi borlar, 0071). Tasdiqlangan
 * kompaniyalar avval; har birida faol vakansiyalar soni. Qidiruv — oddiy GET forma (JS'siz ham ishlaydi). Soxta logo yoki
 * kompaniya yo'q: logotip bo'lmasa — bosh harf.
 */
export default async function CompaniesPage({ searchParams }: { searchParams: SearchParams }) {
  const p = parse(await searchParams);
  const [{ t, name }, regions, categories] = await Promise.all([getT(), getRegions(), getCategories()]);
  const region = p.region ? (regions.find((r) => r.slug === p.region) ?? null) : null;
  const result = await getDirectoryCompanies({ q: p.q, regionId: region?.id ?? null, page: p.page });
  const pageCount = result ? Math.max(1, Math.ceil(result.total / COMPANIES_PAGE_SIZE)) : 1;
  const catName = (id: string | null) => {
    const c = id ? categories.find((x) => x.id === id) : undefined;
    return c ? name(c) : null;
  };
  const regionName = (id: string | null) => {
    const r = id ? regions.find((x) => x.id === id) : undefined;
    return r ? name(r) : null;
  };

  return (
    <Shell>
      <div className="container-wide py-6 sm:py-10">
        <header className="max-w-2xl">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t("welcome.companies.title")}</h1>
          <p className="mt-2 text-lg text-muted-foreground">{t("welcome.companies.lead")}</p>
        </header>

        <form action="/companies" method="get" role="search" className="mt-5 grid gap-2 rounded-2xl border border-border bg-card p-2 sm:grid-cols-[minmax(0,1fr)_14rem_auto]">
          <label className="relative block">
            <span className="sr-only">{t("welcome.companies.search_label")}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              name="q"
              defaultValue={p.q}
              placeholder={t("welcome.companies.search_placeholder")}
              className="h-12 w-full rounded-xl border border-input bg-background pl-10 pr-3 text-base outline-none focus:ring-2 focus:ring-ring/40"
            />
          </label>
          <label className="block">
            <span className="sr-only">{t("welcome.companies.region_label")}</span>
            <select name="region" defaultValue={p.region} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus:ring-2 focus:ring-ring/40">
              <option value="">{t("welcome.companies.all_regions")}</option>
              {regions.map((r) => (
                <option key={r.id} value={r.slug}>
                  {name(r)}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" size="lg" className="h-12">
            {t("welcome.companies.search")}
          </Button>
        </form>

        {result === null ? (
          <EmptyState className="mt-6" icon={Building2} title={t("welcome.companies.error_title")} description={t("welcome.companies.error_desc")} />
        ) : result.items.length === 0 ? (
          <EmptyState
            className="mt-6"
            icon={Building2}
            title={p.q || region ? t("welcome.companies.empty_filtered") : t("welcome.companies.empty_title")}
            description={t("welcome.companies.empty_desc")}
            action={p.q || region ? { label: t("welcome.companies.reset"), href: "/companies" } : { label: t("welcome.companies.post_cta"), href: "/post/vacancy" }}
          />
        ) : (
          <>
            <p className="mt-5 text-sm text-muted-foreground" aria-live="polite">
              {t("welcome.companies.count", { count: result.total })}
            </p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4 4xl:grid-cols-5">
              {result.items.map((c) => {
                const industry = catName(c.industryCategoryId);
                const place = regionName(c.regionId);
                return (
                  <li key={c.id}>
                    <Link
                      href={`/company/${c.slug}`}
                      className="press flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/50"
                    >
                      <span className="flex items-start gap-3">
                        <Avatar src={c.logoUrl} fallback={c.name.slice(0, 1).toUpperCase()} size="lg" square className="rounded-xl" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-base font-bold">{c.name}</span>
                            {c.verified ? <BadgeCheck className="size-4 shrink-0 text-primary-ink" aria-label={t("welcome.companies.verified")} /> : null}
                          </span>
                          {industry ? <span className="block truncate text-sm text-muted-foreground">{industry}</span> : null}
                          {place ? (
                            <span className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                              <MapPin className="size-3.5 shrink-0" aria-hidden />
                              <span className="truncate">{place}</span>
                            </span>
                          ) : null}
                        </span>
                      </span>
                      {c.about ? <span className="line-clamp-2 text-sm text-muted-foreground">{c.about}</span> : null}
                      <span className="mt-auto flex items-center justify-between gap-2 pt-1">
                        <span className="text-sm font-bold text-primary-ink">{t("welcome.companies.jobs", { count: c.activeJobs })}</span>
                        {c.isGovernment ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                            <Landmark className="size-3.5" aria-hidden />
                            {t("welcome.companies.government")}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {pageCount > 1 ? (
              <nav className="mt-6 flex items-center justify-center gap-2" aria-label={t("welcome.companies.pages")}>
                {p.page > 1 ? (
                  <Button asChild variant="outline">
                    <Link href={href({ ...p, page: p.page - 1 })}>
                      <ChevronLeft className="size-4" aria-hidden /> {t("common.actions.back")}
                    </Link>
                  </Button>
                ) : null}
                <span className="px-2 text-sm text-muted-foreground">
                  {p.page} / {pageCount}
                </span>
                {p.page < pageCount ? (
                  <Button asChild variant="outline">
                    <Link href={href({ ...p, page: p.page + 1 })}>
                      {t("common.actions.next")} <ChevronRight className="size-4" aria-hidden />
                    </Link>
                  </Button>
                ) : null}
              </nav>
            ) : null}
          </>
        )}
      </div>
    </Shell>
  );
}
