import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, ChevronRight, Search, UserRound, UsersRound } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { publicEnv } from "@/lib/env";
import type { SessionContext } from "@/features/auth/session";
import { countMyListings } from "@/features/cabinet/queries";
import { AiProCard } from "@/features/ai-alerts/components/ai-pro-card";

/**
 * Bosh sahifa — uchta yo'l, har biri qayerga olib borishini aytadi:
 *  1) "Ish qidiryapsizmi?" → o'zingiz haqingizda e'lon berish (/post/worker);
 *  2) "Ishchi kerakmi?" → ish e'loni berish (/post/vacancy);
 *  3) "E'lonlarni ko'rish" → ro'yxatdan o'tmasdan qidiruv: ish e'lonlari yoki ishchilar (qidiruvning birinchi savoli o'tkazib yuboriladi).
 * Kartalar neytral, bitta aksent rang (tugmalar). Ostida — pullik bonus "AI yordamchi · PRO", pastda ixcham "Kabinetim".
 */
export async function HomeThree({ session }: { session: SessionContext | null }) {
  const { t } = await getT();
  const count = session ? await countMyListings(session) : 0;
  const base = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const jsonLd = JSON.stringify([
    { "@context": "https://schema.org", "@type": "Organization", name: "Ish topdim", url: base, logo: `${base}/icons/icon-512.png`, description: t("common.meta.org_description") },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Ish topdim",
      url: base,
      inLanguage: ["uz", "ru"],
      potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${base}/search?q={search_term_string}` }, "query-input": "required name=search_term_string" },
    },
  ]).replace(/</g, "\\u003c");

  // Ikki rol uchun e'lon berish (karta butunlay bosiladi) va ro'yxatdan o'tmasdan ko'rib chiqish — har tugma qayerga olib borishini aytadi
  const posts = [
    { href: "/post/worker", icon: BriefcaseBusiness, title: t("easy.home.worker_title"), desc: t("easy.home.worker_desc"), cta: t("easy.home.worker_cta") },
    { href: "/post/vacancy", icon: UsersRound, title: t("easy.home.employer_title"), desc: t("easy.home.employer_desc"), cta: t("easy.home.employer_cta") },
  ];
  const browse = [
    { href: "/search?mode=jobs", icon: BriefcaseBusiness, label: t("easy.home.search_jobs") },
    { href: "/search?mode=workers", icon: UsersRound, label: t("easy.home.search_workers") },
  ];

  return (
    <div className="container-app py-6 sm:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <header className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t("easy.home.title")}</h1>
        <p className="mt-1 text-lg text-muted-foreground sm:text-xl">{t("easy.home.subtitle")}</p>
      </header>

      <ul className="pop-list mx-auto mt-6 grid max-w-5xl gap-4 sm:mt-8 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((c) => (
          <li key={c.href} className="flex">
            <Link
              href={c.href}
              data-track="direction_select"
              data-track-to={c.href}
              className="press group flex w-full flex-col rounded-2xl border border-border bg-card p-5 shadow-sm hover:border-primary/50 active:scale-[0.98] sm:p-6"
            >
              <span className="flex items-center gap-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary" aria-hidden>
                  <c.icon className="size-7" />
                </span>
                <span className="min-w-0 break-words text-xl font-bold leading-tight lg:text-2xl">{c.title}</span>
              </span>
              <span className="mt-3 block flex-1 text-base leading-snug text-muted-foreground">{c.desc}</span>
              <span className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-center text-base font-bold leading-tight text-primary-foreground group-hover:bg-primary-hover">
                {c.cta} <ArrowRight className="size-5 shrink-0" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
        <li className="flex md:col-span-2 lg:col-span-1">
          <section aria-labelledby="home-browse" className="flex w-full flex-col rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <span className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary" aria-hidden>
                <Search className="size-7" />
              </span>
              <h2 id="home-browse" className="min-w-0 break-words text-xl font-bold leading-tight lg:text-2xl">
                {t("easy.home.search_title")}
              </h2>
            </span>
            <p className="mt-3 flex-1 text-base leading-snug text-muted-foreground">{t("easy.home.search_desc")}</p>
            <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-1">
              {browse.map((b) => (
                <Link
                  key={b.href}
                  href={b.href}
                  data-track="direction_select"
                  data-track-to={b.href}
                  className="press inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-base font-semibold text-primary hover:border-primary/50 hover:bg-primary-soft/50 active:scale-[0.98]"
                >
                  <b.icon className="size-5 shrink-0" aria-hidden /> {b.label}
                </Link>
              ))}
            </div>
          </section>
        </li>
      </ul>

      {/* Pullik bonus: AI yordamchi — ko'zga tashlanib turadi */}
      <Suspense fallback={<div className="mx-auto mt-6 h-64 max-w-5xl animate-pulse rounded-2xl bg-secondary" aria-hidden />}>
        <AiProCard userId={session?.userId ?? null} className="mx-auto mt-6 max-w-5xl" />
      </Suspense>

      <Link
        href={session ? "/cabinet" : "/auth?next=%2Fcabinet"}
        className="mx-auto mt-8 flex max-w-5xl items-center gap-4 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:bg-secondary/60"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground" aria-hidden>
          <UserRound className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{t("easy.cabinet.title")}</span>
          <span className="block text-base text-muted-foreground">{session ? t("easy.cabinet.home_hint", { count }) : t("easy.cabinet.home_hint_guest")}</span>
        </span>
        <ChevronRight className="size-6 shrink-0 text-muted-foreground" aria-hidden />
      </Link>

      <footer className="mt-10 border-t border-border pt-6 text-center text-sm text-muted-foreground">
        <div className="mb-2 flex flex-wrap justify-center gap-x-3 font-medium">
          <Link href="/help" className="inline-flex min-h-12 items-center px-1 text-base text-primary hover:underline">
            {t("common.footer.support")}
          </Link>
          <Link href="/terms" className="inline-flex min-h-12 items-center px-1 text-base text-primary hover:underline">
            {t("common.footer.terms")}
          </Link>
          <Link href="/privacy" className="inline-flex min-h-12 items-center px-1 text-base text-primary hover:underline">
            {t("common.footer.privacy")}
          </Link>
          <Link href="/account-deletion" className="inline-flex min-h-12 items-center px-1 text-base text-primary hover:underline">
            {t("common.footer.deletion")}
          </Link>
        </div>
        {t("common.footer.rights", { year: new Date().getFullYear() })}
      </footer>
    </div>
  );
}
