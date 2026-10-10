import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, ChevronRight, Search, UserRound, UsersRound } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { publicEnv } from "@/lib/env";
import type { SessionContext } from "@/features/auth/session";
import { countMyListings } from "@/features/cabinet/queries";
import { AiProCard } from "@/features/ai-alerts/components/ai-pro-card";
import { cn } from "@/lib/utils";
import { PopSounds } from "@/components/shared/pop-sounds";

/**
 * Bosh sahifa — uchta katta karta: "Ish qidiryapman", "Ishchi qidiryapman", "Qidirish".
 * Har kartaning butun yuzasi bosiladi. Statistikalar, bannerlar va ko'p menyular yo'q.
 * Ostida — pullik bonus "AI yordamchi · PRO" (mos ish yoki ishchi chiqishi bilan Telegram'ga xabar).
 * "Kabinetim" — pastda ixcham qator, kartalardan kuchsizroq ko'rinadi.
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

  const cards = [
    {
      href: "/post/worker",
      icon: BriefcaseBusiness,
      title: t("easy.home.worker_title"),
      desc: t("easy.home.worker_desc"),
      cta: t("easy.home.worker_cta"),
      box: "bg-primary text-primary-foreground",
      sub: "text-primary-foreground/90",
      iconBox: "bg-white/20",
      pill: "bg-white text-primary",
    },
    {
      href: "/post/vacancy",
      icon: UsersRound,
      title: t("easy.home.employer_title"),
      desc: t("easy.home.employer_desc"),
      cta: t("easy.home.employer_cta"),
      box: "bg-success text-success-foreground",
      sub: "text-success-foreground/90",
      iconBox: "bg-white/20",
      pill: "bg-white text-success",
    },
    {
      href: "/search",
      icon: Search,
      title: t("easy.home.search_title"),
      desc: t("easy.home.search_desc"),
      cta: t("easy.home.search_cta"),
      box: "border-2 border-border bg-card text-foreground",
      sub: "text-muted-foreground",
      iconBox: "bg-primary-soft text-primary",
      pill: "bg-primary text-primary-foreground",
    },
  ];

  return (
    <div className="container-app py-6 text-lg sm:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <header className="text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{t("easy.home.title")}</h1>
        <p className="mt-2 text-xl text-muted-foreground sm:text-2xl">{t("easy.home.subtitle")}</p>
      </header>

      <PopSounds count={cards.length} />
      <ul className="pop-list mx-auto mt-8 grid max-w-5xl gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <li key={c.href} className="flex">
            <Link
              href={c.href}
              transitionTypes={["nav-forward"]}
              data-track="direction_select"
              data-sfx="pop"
              data-track-to={c.href.replace(/[^a-z/]/g, "").slice(0, 40)}
              className={cn(
                "group flex w-full flex-col rounded-3xl p-6 shadow-md transition-[translate,scale] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 focus-visible:ring-4 active:scale-[0.97] active:duration-75 sm:p-7",
                c.box,
              )}
            >
              <span className={cn("flex size-14 items-center justify-center rounded-2xl", c.iconBox)} aria-hidden>
                <c.icon className="size-8" />
              </span>
              <span className="mt-5 block break-words text-2xl font-extrabold leading-tight sm:text-[1.7rem]">{c.title}</span>
              <span className={cn("mt-2 block flex-1 text-lg leading-snug", c.sub)}>{c.desc}</span>
              <span className={cn("mt-6 inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-5 text-lg font-bold", c.pill)}>
                {c.cta} <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/* Pullik bonus: AI yordamchi — ko'zga tashlanib turadi */}
      <Suspense fallback={<div className="mx-auto mt-6 h-64 max-w-5xl animate-pulse rounded-3xl bg-secondary" aria-hidden />}>
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
