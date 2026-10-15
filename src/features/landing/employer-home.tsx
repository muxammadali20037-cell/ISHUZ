import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Building2, ChevronRight, Plus, UsersRound } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import type { SessionContext } from "@/features/auth/session";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkerResultCard } from "@/features/find/components/result-cards";
import { RetryButton } from "@/features/find/components/find-client";
import { MarketAside } from "@/features/find/components/market-aside";
import { savedIdSet } from "@/features/saved/queries";
import { AiProRow } from "@/features/ai-alerts/components/ai-pro-card";
import { HomeQuickLinks } from "@/features/home-windows/home-windows";
import { getHomeSettings } from "@/features/home-windows/queries";
import { windowsFor } from "@/features/home-windows/model";
import { EmployerDashboard } from "@/features/employer/components/dashboard/employer-dashboard";
import { HomeSearch } from "./home-search";
import { getHomePlace, getNewWorkers, type HomePlace } from "./home-queries";
import { employerQuickFilters, placeChooserHref } from "./quick-filters";

/**
 * Ish beruvchi bosh sahifasi. Profili bor — panel (vakansiya joylash, qisqa ko'rsatkichlar, yangi arizalar, faol vakansiyalar,
 * nomzodlar). Mehmon yoki profil hali yo'q — nomzod qidiruvi, "Vakansiya joylash" va eng yangi nomzodlar.
 * Rejim faqat ko'rinishni tanlaydi: ruxsatlar serverda (requireEmployer, RLS) — rejim o'zgarsa ham kengaymaydi.
 */
export async function EmployerHome({ session }: { session: SessionContext | null }) {
  // panel — /employer bilan bir xil shart (requireEmployer): profil bor va to'ldirilgan
  if (session?.employerId && session.employerOnboarded) return <EmployerDashboard session={session as SessionContext & { employerId: string }} embedded />;
  const [{ t, name }, place] = await Promise.all([getT(), getHomePlace()]);
  const placeLabel = place.region ? (place.district ? `${name(place.region)} · ${name(place.district)}` : name(place.region)) : t("easy.location.whole_country");
  const chips = employerQuickFilters({ region: place.region?.slug ?? null, district: place.district?.id ?? null }).map((c) => ({
    ...c,
    label: c.key === "near" ? t("easy.mode.near_me") : t("easy.start.f_experienced"),
  }));
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-7">
        <section aria-labelledby="home-title" className="space-y-3">
          <div>
            <h1 id="home-title" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              {t("easy.start.employer_title")}
            </h1>
            <p className="mt-0.5 text-base text-muted-foreground">{t("easy.start.employer_subtitle")}</p>
          </div>
          <HomeSearch
            scope="workers"
            label={t("easy.start.employer_search_label")}
            placeholder={t("easy.start.employer_search_placeholder")}
            place={{ label: placeLabel, href: placeChooserHref("workers") }}
            chips={chips}
          />
        </section>

        {/* asosiy harakat: oddiy brend tugmasi (katta banner emas) */}
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:p-5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary" aria-hidden>
            <UsersRound className="size-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-bold leading-tight">{t("easy.home.employer_title")}</span>
            <span className="block text-base text-muted-foreground">{t("easy.start.post_vacancy_hint")}</span>
          </span>
          <Button asChild className="h-auto min-h-12 shrink-0 whitespace-normal px-5 py-2 text-center text-base font-bold leading-tight">
            <Link href="/post/vacancy">
              <Plus className="size-5" aria-hidden /> {t("easy.start.post_vacancy")}
            </Link>
          </Button>
        </section>

        {session ? (
          // kirgan, lekin ish beruvchi profili yo'q: bir daqiqalik to'ldirish (arizalar va vakansiyalar shundan keyin)
          <Link href="/onboarding/employer" className="press flex min-h-16 items-center gap-3 rounded-2xl border border-primary/40 bg-primary-soft/40 px-4 py-3 hover:border-primary">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-card text-primary" aria-hidden>
              <Building2 className="size-5" />
            </span>
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

        <Suspense fallback={null}>
          <EmployerExtras userId={session?.userId ?? null} />
        </Suspense>
      </div>
      <Suspense fallback={<div className="hidden lg:block" aria-hidden />}>
        <MarketAside mode="workers" />
      </Suspense>
    </div>
  );
}

async function NewWorkers({ session, place }: { session: SessionContext | null; place: HomePlace }) {
  const [{ t, name }, feed] = await Promise.all([getT(), getNewWorkers(place)]);
  if (!feed.ok) {
    return (
      <section role="alert" aria-labelledby="home-feed" className="space-y-3 rounded-2xl border border-warning/40 bg-warning-soft p-5 text-center">
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
        <h2 id="home-feed" className="min-w-0 text-xl font-bold leading-tight">
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
        <div className="mt-3 rounded-2xl border border-dashed border-border bg-card p-6 text-center">
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
        <div key={i} className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
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
      <h2 className="text-lg font-bold">{t("easy.start.more_title")}</h2>
      <HomeQuickLinks windows={windowsFor("employer", home.windows)} />
      <AiProRow userId={userId} role="employer" />
    </div>
  );
}
