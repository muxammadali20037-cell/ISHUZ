import "server-only";

import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { getCategories, getRegions } from "@/lib/reference";
import { localeAlternates } from "@/lib/seo";
import { formatSalaryRange } from "@/lib/format";
import { descriptionExcerpt } from "./description";
import { countActiveFilters, jobsHref, type JobsSearchParams } from "./search-params";
import type { VacancyDetail } from "./types";

/** /jobs sahifasi SEO: sarlavha kategoriya/hududga qarab */
export async function jobsListMetadata(params: JobsSearchParams): Promise<Metadata> {
  const { t, name, locale } = await getT();
  const [categories, regions] = await Promise.all([getCategories(), getRegions()]);
  const category = params.category ? (categories.find((c) => c.slug === params.category) ?? null) : null;
  const region = params.region ? (regions.find((r) => r.slug === params.region) ?? null) : null;

  let title = t("jobs.meta.title");
  if (category && region) title = t("jobs.meta.title_category_region", { category: name(category), region: name(region) });
  else if (category) title = t("jobs.meta.title_category", { category: name(category) });
  else if (region) title = t("jobs.meta.title_region", { region: name(region) });
  else if (params.q) title = t("jobs.meta.title_query", { query: params.q });

  const description = t("jobs.meta.description");
  const canonical = jobsHref({ category: params.category, subcategory: params.subcategory, region: params.region });
  const noindex = params.page > 1 || !!params.q || countActiveFilters(params) > 2;
  return {
    title,
    description,
    alternates: localeAlternates(canonical, locale),
    openGraph: { title: `${title} · Ish Beruvchi`, description, url: canonical, type: "website", locale: locale === "ru" ? "ru_RU" : locale === "en" ? "en_US" : locale === "oz" ? "uz_UZ" : "uz_UZ" },
    robots: noindex ? { index: false, follow: true } : undefined,
  };
}

/** /jobs/[slug] SEO: "{title} — {company}", maosh/manzil/tavsif qisqartmasi, OpenGraph */
export async function vacancyMetadata(v: VacancyDetail): Promise<Metadata> {
  const { t, locale, name } = await getT();
  const company = v.company?.name ?? t("common.role.employer");
  const title = `${v.title} — ${company}`;
  const salary =
    v.salary_negotiable || (!v.salary_from && !v.salary_to)
      ? t("common.labels.negotiable")
      : formatSalaryRange(v.salary_from, v.salary_to, locale, {
          negotiable: t("common.labels.negotiable"),
          from: t("common.labels.from"),
          to: t("common.labels.to"),
        });
  const location = v.is_remote ? t("jobs.detail.remote") : [name(v.district), name(v.region)].filter(Boolean).join(", ") || t("common.labels.not_specified");
  const description = [t("jobs.meta.detail_description", { title: v.title, company, salary, location }), descriptionExcerpt(v.description, 120)]
    .filter(Boolean)
    .join(" ")
    .slice(0, 300);
  const url = `/jobs/${v.slug}`;
  return {
    title,
    description,
    alternates: localeAlternates(url, locale),
    openGraph: {
      title: `${title} · Ish Beruvchi`,
      description,
      url,
      type: "article",
      publishedTime: v.published_at ?? undefined,
      // Telegram/Facebook oldindan ko'rinishi: vakansiya reklama kartasi
      images: [{ url: `/api/promo/vacancy/${v.slug}?f=og`, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image" },
    robots: v.status === "active" ? undefined : { index: false, follow: false },
  };
}
