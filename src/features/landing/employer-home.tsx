import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, CalendarDays, ChevronRight, MapPin, Plus, UsersRound } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import type { SessionContext } from "@/features/auth/session";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkerResultCard } from "@/features/find/components/result-cards";
import { RetryButton } from "@/features/find/components/find-client";
import { savedIdSet } from "@/features/saved/queries";
import { AiProRow } from "@/features/ai-alerts/components/ai-pro-card";
import { HomeQuickLinks } from "@/features/home-windows/home-windows";
import { getHomeSettings } from "@/features/home-windows/queries";
import { windowsFor } from "@/features/home-windows/model";
import { EmployerDashboard } from "@/features/employer/components/dashboard/employer-dashboard";
import { SeekerSearch } from "./home-search";
import { ServiceTiles, type ServiceTile } from "@/components/shared/service-tiles";
import { cn } from "@/lib/utils";
import { getHomePlace, getNewWorkers, type HomePlace } from "./home-queries";
import { employerServiceHrefs, placeChooserHref } from "./quick-filters";
import { HireSectionList } from "./section-tiles";

/**
 * Ish beruvchi bosh sahifasi. Profili bor — panel (vakansiya joylash, qisqa ko'rsatkichlar, yangi arizalar, faol vakansiyalar,
 * nomzodlar). Mehmon yoki profil hali yo'q — nomzod qidiruvi, "Vakansiya joylash" va eng yangi nomzodlar.
 * Rejim faqat ko'rinishni tanlaydi: ruxsatlar serverda (requireEmployer, RLS) — rejim o'zgarsa ham kengaymaydi.
 */
export async function EmployerHome({ session, flush = false }: { session: SessionContext | null; flush?: boolean }) {
  // panel — /employer bilan bir xil shart (requireEmployer): profil bor va to'ldirilgan
  if (session?.employerId && session.employerOnboarded) return <EmployerDashboard session={session as SessionContext & { employerId: string }} embedded />;
  const [{ t, name }, place, home] = await Promise.all([getT(), getHomePlace(), getHomeSettings()]);
  const placeLabel = place.region ? (place.district ? `${name(place.region)} · ${name(place.district)}` : name(place.region)) : t("easy.location.whole_country");
  const where = { region: place.region?.slug ?? null, district: place.district?.id ?? null };
  const hrefs = employerServiceHrefs(where);
  const firstName = session?.profile.first_name?.trim();
  const tiles: ServiceTile[] = [
    { key: "candidates", href: hrefs.candidates, label: t("easy.services.e_candidates"), hint: t("easy.services.e_candidates_hint"), icon: UsersRound, tone: "indigo", featured: true, track: "home_service" },
    { key: "daily", href: hrefs.daily, label: t("easy.services.e_daily"), hint: t("easy.services.e_daily_hint"), icon: CalendarDays, tone: "orange", track: "home_service" },
    { key: "experienced", href: hrefs.experienced, label: t("easy.services.e_exp"), hint: t("easy.services.e_exp_hint"), icon: BadgeCheck, tone: "green", track: "home_service" },
    { key: "near", href: hrefs.near, label: t("easy.services.e_near"), hint: t("easy.services.e_near_hint"), icon: MapPin, tone: "cyan", track: "home_service" },
  ];
  // mini-ilova uslubi: chuqur ko'k sarlavha (asosiy amal — yaltirab turadigan "Vakansiya joylash", nomzod qidiruvi va jonli AI
  // qatori), ustiga chiqib turadigan xizmatlar, keyin darhol yangi nomzodlar. Statistika banneri yo'q.
  return (
    <div className="space-y-6">
      <div>
        <section
          aria-labelledby="home-title"
          className={cn("hero-surface px-4 pb-16 pt-5 sm:rounded-2xl sm:px-6 sm:pt-6 lg:px-8 lg:pb-20 lg:pt-8", flush ? "-mx-4 -mt-4 sm:mx-0 sm:mt-0" : "rounded-2xl")}
        >
          <p className="text-sm font-semibold text-hero-muted">{firstName ? t("easy.services.greeting", { name: firstName }) : t("easy.services.greeting_guest")}</p>
          <div className="mt-0.5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h1 id="home-title" className="text-2xl font-extrabold leading-tight tracking-tight text-hero-fg sm:text-3xl lg:text-4xl">
                {t("easy.start.employer_title")}
              </h1>
              <p className="mt-1 max-w-xl text-sm text-hero-muted sm:text-base">{t("easy.services.hire_sub")}</p>
            </div>
            <Link
              href="/post/vacancy"
              data-track="home_post_vacancy"
              className="press shine btn-light inline-flex min-h-13 shrink-0 items-center justify-center gap-2 rounded-2xl px-6 text-base font-extrabold"
            >
              <Plus className="relative z-10 size-5" aria-hidden />
              <span className="relative z-10">{t("easy.start.post_vacancy")}</span>
            </Link>
          </div>
          <div className="mt-4 lg:max-w-3xl">
            <SeekerSearch
              scope="workers"
              label={t("easy.start.employer_search_label")}
              placeholder={t("easy.start.employer_search_placeholder")}
              place={{ label: placeLabel, href: placeChooserHref("workers"), ...where }}
              filtersHref={hrefs.candidates}
              ai={home.aiButton}
            />
          </div>
        </section>
        <ServiceTiles items={tiles} label={t("easy.services.label")} className="relative z-10 -mt-11 lg:-mt-12 lg:mx-4" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          {session ? (
            // kirgan, lekin ish beruvchi profili yo'q: bir daqiqalik to'ldirish (arizalar va vakansiyalar shundan keyin)
            <Link href="/onboarding/employer" className="press flex min-h-16 items-center gap-3 rounded-xl border border-primary/40 bg-primary-soft/40 px-4 py-3 hover:border-primary">
              <Building2 className="size-5 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{t("easy.start.finish_company_title")}</span>
                <span className="block text-sm leading-snug text-muted-foreground">{t("easy.start.finish_company_desc")}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          ) : null}

          <Suspense fallback={<WorkersSkeleton />}>
            <NewWorkers session={session} place={place} />
          </Suspense>
        </div>
        <aside aria-label={t("easy.start.more_title")} className="min-w-0 space-y-5">
          <Suspense fallback={null}>
            <HireSectionList place={place} />
          </Suspense>
          <Suspense fallback={null}>
            <EmployerExtras userId={session?.userId ?? null} />
          </Suspense>
        </aside>
      </div>
    </div>
  );
}

async function NewWorkers({ session, place }: { session: SessionContext | null; place: HomePlace }) {
  const [{ t, name }, feed] = await Promise.all([getT(), getNewWorkers(place)]);
  if (!feed.ok) {
    return (
      <section role="alert" aria-labelledby="home-feed" className="space-y-3 rounded-xl border border-warning/40 bg-warning-soft p-5 text-center">
        <h2 id="home-feed" className="text-xl font-bold">
          {t("easy.start.list_error_title")}
        </h2>
        <p className="text-muted-foreground">{t("easy.start.list_error_desc")}</p>
        <div className="mx-auto grid max-w-sm">
          <RetryButton label={t("easy.search.retry")} />
        </div>
        <p className="text-sm text-muted-foreground">{t("easy.search.error_code", { code: feed.errorId })}</p>
      </section>
    );
  }
  const saved = await savedIdSet(session, "worker", feed.items.map((i) => i.id));
  const more = feed.total > feed.items.length;
  return (
    <section aria-labelledby="home-feed">
      <div className="flex items-center justify-between gap-3">
        <h2 id="home-feed" className="min-w-0 text-lg font-bold leading-tight">
          {t("easy.start.new_workers_title")}
        </h2>
        {more ? (
          <Link href={feed.allHref} className="-my-2 inline-flex min-h-11 shrink-0 items-center gap-1 text-base font-semibold text-primary hover:underline">
            {t("easy.start.see_all")} <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
      <p className="mt-0.5 text-sm text-muted-foreground">{t("easy.start.new_reason", { place: feed.region ? name(feed.region) : t("easy.location.whole_country") })}</p>
      {feed.items.length ? (
        <ul className="pop-list mt-3 grid grid-cols-1 gap-3">
          {feed.items.map((w) => (
            <li key={w.id}>
              <WorkerResultCard worker={w} imageUrl={w.profession_node_id ? feed.images[w.profession_node_id] : null} saved={saved.has(w.id)} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-lg font-bold">{t("easy.start.workers_empty_title")}</p>
          <p className="mt-1 text-muted-foreground">{t("easy.start.workers_empty_desc")}</p>
        </div>
      )}
      {more ? (
        <Button asChild variant="outline" className="mt-3 h-12 w-full text-base font-semibold">
          <Link href={feed.allHref}>
            {t("easy.start.all_workers", { count: feed.total >= 5000 ? "5 000+" : feed.total })} <ArrowRight className="size-5" aria-hidden />
          </Link>
        </Button>
      ) : null}
    </section>
  );
}

function WorkersSkeleton() {
  return (
    <div aria-hidden className="space-y-3">
      <Skeleton className="h-6 w-44" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-3 sm:p-4">
          <div className="flex gap-3">
            <Skeleton className="size-12 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
          <Skeleton className="mt-3 h-11 w-36 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

async function EmployerExtras({ userId }: { userId: string | null }) {
  const [{ t }, home] = await Promise.all([getT(), getHomeSettings()]);
  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold">{t("easy.start.more_title")}</h2>
      <HomeQuickLinks windows={windowsFor("employer", home.windows)} stacked />
      <AiProRow userId={userId} role="employer" />
    </div>
  );
}
