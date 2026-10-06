import Link from "next/link";
import { billingEnabled } from "@/lib/features";
import { ArrowRight, Briefcase, Building2, Search, UserRound, Sparkles, MessageCircle } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/shared/category-icon";
import { QuickActions } from "@/components/shared/quick-actions";
import { getCategories, getRegions } from "@/lib/reference";
import { publicEnv } from "@/lib/env";

export async function LandingPage() {
  const { t, name } = await getT();
  const supabase = await createClient();
  const [allCategories, regions] = await Promise.all([getCategories(), getRegions()]);
  const base = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  // Google: sayt nomi, logotip va sayt ichidagi qidiruv (sitelinks search box)
  const jsonLd = JSON.stringify([
    { "@context": "https://schema.org", "@type": "Organization", name: "Ish Beruvchi", url: base, logo: `${base}/icons/icon-512.png`, description: t("common.meta.org_description") },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Ish Beruvchi",
      url: base,
      inLanguage: ["uz", "ru"],
      potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${base}/jobs?q={search_term_string}` }, "query-input": "required name=search_term_string" },
    },
  ]).replace(/</g, "\\u003c");
  const [{ data: categories }, { count: vacancyCount }] = await Promise.all([
    supabase.from("categories").select("id, slug, name_uz, name_ru, icon").eq("is_active", true).order("sort_order").limit(12),
    supabase.from("vacancies").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  return (
    <div className="container-app py-6 sm:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <section className="text-center">
        <h1 className="mx-auto max-w-2xl text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl">{t("common.landing.hero_title")}</h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground sm:text-lg">{t("common.landing.hero_subtitle")}</p>
      </section>

      <QuickActions />

      <section className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-2">
        <Link
          href="/auth?next=%2Fonboarding%2Fworker"
          className="group flex flex-col rounded-3xl bg-primary p-6 text-primary-foreground shadow-md transition-transform hover:-translate-y-0.5 sm:p-8"
        >
          <span className="flex size-14 items-center justify-center rounded-2xl bg-white/15">
            <UserRound className="size-7" />
          </span>
          <span className="mt-5 text-2xl font-bold">{t("common.landing.worker_card_title")}</span>
          <span className="mt-1 text-primary-foreground/80">{t("common.landing.worker_card_subtitle")}</span>
          <span className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 font-semibold text-primary">
            {t("common.landing.worker_card_cta")} <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
        <Link
          href="/auth?next=%2Fonboarding%2Femployer"
          className="group flex flex-col rounded-3xl border border-border bg-card p-6 shadow-sm transition-transform hover:-translate-y-0.5 sm:p-8"
        >
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <Building2 className="size-7" />
          </span>
          <span className="mt-5 text-2xl font-bold">{t("common.landing.employer_card_title")}</span>
          <span className="mt-1 text-muted-foreground">{t("common.landing.employer_card_subtitle")}</span>
          <span className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground">
            {t("common.landing.employer_card_cta")} <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      </section>

      <section className="mt-12">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-xl font-bold">{t("common.landing.categories_title")}</h2>
          <Link href="/jobs" className="text-sm font-medium text-primary hover:underline">
            {t("common.actions.view_all")}
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {(categories ?? []).map((c) => (
            <Link key={c.id} href={`/jobs?category=${c.slug}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-colors hover:border-primary/40 hover:bg-primary-soft/40">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <CategoryIcon name={c.icon} className="size-5" />
              </span>
              <span className="text-sm font-medium leading-tight">{name(c)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="mb-5 text-center text-xl font-bold">{t("common.landing.how_title")}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: Briefcase, title: t("common.landing.how_1_title"), desc: t("common.landing.how_1_desc") },
            { icon: Sparkles, title: t("common.landing.how_2_title"), desc: t("common.landing.how_2_desc") },
            { icon: MessageCircle, title: t("common.landing.how_3_title"), desc: t("common.landing.how_3_desc") },
          ].map((s, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <s.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 flex flex-col items-start gap-4 rounded-3xl bg-secondary p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">{t("common.landing.for_employers")}</p>
          <h2 className="mt-1 text-xl font-bold">{t("common.app.tagline_employer")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("common.landing.employer_pitch")}</p>
        </div>
        <Button asChild size="lg">
          <Link href="/auth?next=%2Fonboarding%2Femployer">{t("common.landing.post_vacancy")}</Link>
        </Button>
      </section>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Search className="size-4" /> {vacancyCount ?? 0} {t("common.landing.stats_vacancies")}
        </span>
      </div>

      {/* Qidiruv tizimlari uchun ham foydali: hudud va kasb bo'yicha ish sahifalariga to'g'ridan-to'g'ri havolalar */}
      <section className="mt-12 grid gap-8 sm:grid-cols-2">
        <nav aria-labelledby="seo-regions">
          <h2 id="seo-regions" className="mb-3 text-lg font-bold">
            {t("common.landing.seo_regions")}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {regions.map((r) => (
              <li key={r.id}>
                <Link href={`/jobs?region=${r.slug}`} className="inline-block rounded-full border border-border px-3 py-1.5 text-sm hover:border-primary hover:text-primary">
                  {name(r)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-labelledby="seo-categories">
          <h2 id="seo-categories" className="mb-3 text-lg font-bold">
            {t("common.landing.seo_categories")}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {allCategories.map((c) => (
              <li key={c.id}>
                <Link href={`/jobs?category=${c.slug}`} className="inline-block rounded-full border border-border px-3 py-1.5 text-sm hover:border-primary hover:text-primary">
                  {name(c)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>

      <footer className="mt-10 border-t border-border pt-6 text-center text-xs text-muted-foreground">
        <div className="mb-2 flex flex-wrap justify-center gap-x-4 gap-y-1 font-medium">
          {billingEnabled() ? (
            <Link href="/pricing" className="text-primary hover:underline">
              {t("welcome.quick.pricing")}
            </Link>
          ) : null}
          <Link href="/privacy" className="text-primary hover:underline">
            {t("common.footer.privacy")}
          </Link>
          <Link href="/account-deletion" className="text-primary hover:underline">
            {t("common.footer.deletion")}
          </Link>
        </div>
        {t("common.footer.rights", { year: new Date().getFullYear() })}
      </footer>
    </div>
  );
}
