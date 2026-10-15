import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, FileUser, Inbox } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import type { SessionContext } from "@/features/auth/session";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryIcon } from "@/components/shared/category-icon";
import { EMPTY_FIND, findHref } from "@/features/find/params";
import { JobResultCard } from "@/features/find/components/result-cards";
import { RetryButton } from "@/features/find/components/find-client";
import { MarketAside } from "@/features/find/components/market-aside";
import { savedIdSet } from "@/features/saved/queries";
import { myApplicationStatuses } from "@/features/applications/queries";
import { AiProRow } from "@/features/ai-alerts/components/ai-pro-card";
import { HomeQuickLinks } from "@/features/home-windows/home-windows";
import { getHomeSettings } from "@/features/home-windows/queries";
import { windowsFor } from "@/features/home-windows/model";
import { HomeSearch } from "./home-search";
import { getHomePlace, getPopularProfessions, getSeekerFeed, type HomePlace } from "./home-queries";
import { placeChooserHref, seekerQuickFilters } from "./quick-filters";

/**
 * Ish qidiruvchi bosh sahifasi (mehmon ham — ro'yxatdan o'tmasdan ko'radi):
 * qidiruv → tez filtrlar → haqiqiy e'lonlar ("Sizga mos" yoki "Yangi ishlar") → mashhur kasblar → qo'shimcha (e'lon berish, AI PRO).
 * Kompyuterda o'ngda — bozor paneli (statistika, yirik ish beruvchilar).
 */
export async function SeekerHome({ session }: { session: SessionContext | null }) {
  const [{ t, name }, place] = await Promise.all([getT(), getHomePlace()]);
  const placeLabel = placeText(place, name, t("easy.location.whole_country"));
  const chips = seekerQuickFilters({ region: place.region?.slug ?? null, district: place.district?.id ?? null }).map((c) => ({
    ...c,
    label: t(`easy.start.f_${c.key}`),
  }));
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-7">
        <section aria-labelledby="home-title" className="space-y-3">
          <div>
            <h1 id="home-title" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              {t("easy.start.seeker_title")}
            </h1>
            {session ? null : <p className="mt-0.5 text-base text-muted-foreground">{t("easy.start.seeker_subtitle")}</p>}
          </div>
          <HomeSearch
            scope="jobs"
            label={t("easy.start.search_label")}
            placeholder={t("easy.start.search_placeholder")}
            place={{ label: placeLabel, href: placeChooserHref("jobs") }}
            chips={chips}
          />
        </section>

        {/* ro'yxat oqim bilan keladi: qidiruv qatori darhol ishlaydi */}
        <Suspense fallback={<FeedSkeleton />}>
          <SeekerFeed session={session} place={place} />
        </Suspense>

        <Suspense fallback={null}>
          <PopularProfessions place={place} />
        </Suspense>

        <Suspense fallback={null}>
          <SeekerExtras userId={session?.userId ?? null} />
        </Suspense>
      </div>
      {/* statistika so'rovlari ro'yxatni ushlab turmasin */}
      <Suspense fallback={<div className="hidden lg:block" aria-hidden />}>
        <MarketAside mode="jobs" />
      </Suspense>
    </div>
  );
}

type NameFn = (row: { name_uz: string; name_ru: string; name_en?: string | null; name_oz?: string | null } | null | undefined) => string;

function placeText(place: Pick<HomePlace, "region" | "district">, name: NameFn, whole: string): string {
  if (!place.region) return whole;
  return place.district ? `${name(place.region)} · ${name(place.district)}` : name(place.region);
}

async function SeekerFeed({ session, place }: { session: SessionContext | null; place: HomePlace }) {
  const [{ t, name }, feed] = await Promise.all([getT(), getSeekerFeed(session, place)]);
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
  const ids = feed.items.map((i) => i.id);
  const [saved, applied] = await Promise.all([savedIdSet(session, "vacancy", ids), myApplicationStatuses(session?.workerId ?? null, ids)]);
  const where = placeText(feed, name, t("easy.location.whole_country"));
  const more = feed.total > feed.items.length;
  return (
    <section aria-labelledby="home-feed">
      <div className="flex items-center justify-between gap-3">
        <h2 id="home-feed" className="min-w-0 text-xl font-bold leading-tight">
          {feed.kind === "match" ? t("easy.start.match_title") : t("easy.start.new_title")}
        </h2>
        {more ? (
          <Link href={feed.allHref} className="-my-2 inline-flex min-h-11 shrink-0 items-center gap-1 text-base font-semibold text-primary hover:underline">
            {t("easy.start.see_all")} <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
      {/* nega aynan shu ro'yxat: kasb va hudud (soxta foiz yo'q) */}
      <p className="mt-0.5 text-sm text-muted-foreground">
        {feed.kind === "match" ? t("easy.start.match_reason", { profession: name(feed.profession), place: where }) : t("easy.start.new_reason", { place: where })}
      </p>
      {feed.noMatchFor ? <p className="mt-2 rounded-xl bg-secondary px-3 py-2 text-sm">{t("easy.start.no_match_note", { profession: name(feed.noMatchFor) })}</p> : null}
      {feed.items.length ? (
        <ul className="pop-list mt-3 grid grid-cols-1 gap-3">
          {feed.items.map((job) => (
            <li key={job.id}>
              <JobResultCard
                job={job}
                imageUrl={job.profession_node_id ? feed.images[job.profession_node_id] : null}
                photoPath={feed.photos[job.id] ?? null}
                saved={saved.has(job.id)}
                applied={applied.get(job.id) ?? null}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 rounded-2xl border border-dashed border-border bg-card p-6 text-center">
          <Inbox className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-2 text-lg font-bold">{t("easy.start.empty_title")}</p>
          <p className="mt-1 text-muted-foreground">{t("easy.start.empty_desc")}</p>
          <Button asChild className="mt-4 h-12 px-5 text-base">
            <Link href="/post/worker">{t("easy.start.post_resume")}</Link>
          </Button>
        </div>
      )}
      {more ? (
        <Button asChild variant="outline" className="mt-3 h-12 w-full text-base font-semibold">
          <Link href={feed.allHref}>
            {t("easy.start.all_jobs", { count: feed.total >= 5000 ? "5 000+" : feed.total })} <ArrowRight className="size-5" aria-hidden />
          </Link>
        </Button>
      ) : null}
    </section>
  );
}

/** Ro'yxat skeleti: kartalar balandligi haqiqiysiga yaqin — kontent kelganda sahifa siljimaydi */
function FeedSkeleton() {
  return (
    <div aria-hidden className="space-y-3">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-56" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
          <div className="flex gap-3">
            <Skeleton className="size-12 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <Skeleton className="mt-3 h-11 w-36 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

/** Faol e'lonlari ko'p kasblar — bir bosishda shu kasb natijalari (eslab qolingan hududda) */
async function PopularProfessions({ place }: { place: HomePlace }) {
  const [{ t, name }, list] = await Promise.all([getT(), getPopularProfessions()]);
  // ro'yxat bo'lmasa ham kasblar daraxtiga kirish qoladi (bosqichma-bosqich tanlash va qidirish)
  if (!list.length) {
    return (
      <Link
        href={findHref(EMPTY_FIND, { mode: "jobs" })}
        prefetch={false}
        data-track="direction_select"
        className="press flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 text-base font-semibold text-primary hover:border-primary/50"
      >
        {t("easy.start.all_professions")} <ChevronRight className="size-5 shrink-0" aria-hidden />
      </Link>
    );
  }
  const where = { region: place.region?.slug ?? "all", district: place.region ? (place.district?.id ?? "all") : null };
  return (
    <section aria-labelledby="home-professions">
      <div className="flex items-end justify-between gap-3">
        <h2 id="home-professions" className="text-lg font-bold">
          {t("easy.start.professions_title")}
        </h2>
        <Link
          href={findHref(EMPTY_FIND, { mode: "jobs" })}
          prefetch={false}
          data-track="direction_select"
          className="inline-flex min-h-11 shrink-0 items-center gap-1 text-base font-semibold text-primary hover:underline"
        >
          {t("easy.start.all_professions")} <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      <ul className="mt-2 flex flex-wrap gap-2">
        {list.map((p) => (
          <li key={p.id} className="flex max-w-full">
            <Link
              href={findHref(EMPTY_FIND, { mode: "jobs", p: p.id, ...where })}
              prefetch={false}
              className="press inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold hover:border-primary/50 hover:text-primary"
            >
              <CategoryIcon name={p.icon} className="size-4 shrink-0 text-primary" />
              <span className="truncate">{name(p)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Qo'shimcha (ikkinchi darajali): admin sozlagan tezkor bo'limlar, o'zi haqida e'lon, AI PRO */
async function SeekerExtras({ userId }: { userId: string | null }) {
  const [{ t }, home] = await Promise.all([getT(), getHomeSettings()]);
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">{t("easy.start.more_title")}</h2>
      <HomeQuickLinks windows={windowsFor("worker", home.windows)} />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {/* kompyuterda bu tugma o'ng panelda turadi */}
        <Link href="/post/worker" className="press flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 hover:border-primary/50 lg:hidden">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary" aria-hidden>
            <FileUser className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">{t("easy.start.post_resume")}</span>
            <span className="block text-sm leading-snug text-muted-foreground">{t("easy.start.post_resume_desc")}</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
        <AiProRow userId={userId} role="worker" />
      </div>
    </div>
  );
}
