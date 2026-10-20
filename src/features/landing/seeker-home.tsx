import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, FileUser, SearchX } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import type { SessionContext } from "@/features/auth/session";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryIcon } from "@/components/shared/category-icon";
import { EMPTY_FIND, findHref } from "@/features/find/params";
import { JobResultCard } from "@/features/find/components/result-cards";
import { RetryButton } from "@/features/find/components/find-client";
import { savedIdSet } from "@/features/saved/queries";
import { myApplicationStatuses } from "@/features/applications/queries";
import { AiProRow } from "@/features/ai-alerts/components/ai-pro-card";
import { HomeQuickLinks } from "@/features/home-windows/home-windows";
import { getHomeSettings } from "@/features/home-windows/queries";
import { windowsFor } from "@/features/home-windows/model";
import { SeekerSearch } from "./home-search";
import { getHomePlace, getPopularProfessions, getSeekerFeed, type HomePlace } from "./home-queries";
import { placeChooserHref, seekerFiltersHref, seekerQuickFilters } from "./quick-filters";
import { SeekerSectionList } from "./section-tiles";

/**
 * Ish qidiruvchi bosh sahifasi (2026-10 redizayn; mehmon ham — ro'yxatdan o'tmasdan ko'radi). Birinchi ekranda vazifa:
 * qisqa sarlavha → qidiruv (filtrlar va AI unga biriktirilgan) → tez filtrlar → darhol haqiqiy vakansiyalar ro'yxati.
 * Katta bezak plitkalari va statistika bannerlari yo'q. 390×844 da birinchi vakansiyaning nomi, maoshi va hududi ko'rinadi.
 * Kompyuterda: tepada keng qidiruv (hudud shu blokda), ostida ro'yxat (2 ustun) va o'ngda ixcham yordamchi panel —
 * "o'zim haqimda e'lon", bo'limlar (sonlari bilan), mashhur kasblar, admin sozlagan oynalar, AI PRO. Telefonda shu panel ro'yxatdan
 * keyin keladi.
 */
export async function SeekerHome({ session }: { session: SessionContext | null }) {
  const [{ t, name }, place, home] = await Promise.all([getT(), getHomePlace(), getHomeSettings()]);
  const where = { region: place.region?.slug ?? null, district: place.district?.id ?? null };
  const chips = seekerQuickFilters(where).map((c) => ({ ...c, label: t(`easy.start.f_${c.key}`) }));
  return (
    <div className="space-y-5 lg:space-y-6">
      <section aria-labelledby="home-title" className="space-y-3 lg:max-w-3xl">
        <h1 id="home-title" className="text-[1.375rem] font-extrabold leading-tight tracking-tight sm:text-3xl">
          {t("easy.start.seeker_title")}
        </h1>
        <SeekerSearch
          label={t("easy.start.search_label")}
          placeholder={t("easy.start.search_placeholder")}
          place={{ label: placeText(place, name, t("easy.location.whole_country")), href: placeChooserHref("jobs"), ...where }}
          filtersHref={seekerFiltersHref(where)}
          chips={chips}
          ai={home.aiButton}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
        {/* ro'yxat oqim bilan keladi: qidiruv qatori darhol ishlaydi */}
        <Suspense fallback={<FeedSkeleton />}>
          <SeekerFeed session={session} place={place} />
        </Suspense>
        <aside aria-label={t("easy.start.more_title")} className="min-w-0 space-y-5">
          <ResumeCard />
          {/* bo'limlar (sonlari bilan): ish beruvchi turi, ommaviy, TOP, yaqin atrofda — ixcham ro'yxat, ro'yxatdan keyin */}
          <Suspense fallback={null}>
            <SeekerSectionList place={place} />
          </Suspense>
          <Suspense fallback={null}>
            <PopularProfessions place={place} />
          </Suspense>
          <HomeQuickLinks windows={windowsFor("worker", home.windows)} stacked />
          <Suspense fallback={null}>
            <AiProRow userId={session?.userId ?? null} role="worker" />
          </Suspense>
        </aside>
      </div>
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
      <section role="alert" aria-labelledby="home-feed" className="space-y-3 rounded-xl border border-warning/40 bg-warning-soft p-5 text-center">
        <h2 id="home-feed" className="text-lg font-bold">
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
    <section aria-labelledby="home-feed" className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="home-feed" className="min-w-0 text-lg font-bold leading-tight">
          {feed.kind === "match" ? t("easy.start.match_title") : t("easy.start.new_title")}
        </h2>
        {more ? (
          <Link href={feed.allHref} className="-my-2 inline-flex min-h-11 shrink-0 items-center gap-0.5 text-base font-semibold text-primary hover:underline">
            {t("easy.start.see_all")} <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
      {/* nega aynan shu ro'yxat: kasb va hudud (soxta foiz yo'q) */}
      <p className="text-sm text-muted-foreground">
        {feed.kind === "match" ? t("easy.start.match_reason", { profession: name(feed.profession), place: where }) : t("easy.start.new_reason", { place: where })}
      </p>
      {feed.noMatchFor ? <p className="mt-2 rounded-lg bg-secondary px-3 py-2 text-sm">{t("easy.start.no_match_note", { profession: name(feed.noMatchFor) })}</p> : null}
      {feed.items.length ? (
        <ul className="pop-list mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {feed.items.map((job) => (
            <li key={job.id} className="flex [&>article]:w-full">
              <JobResultCard job={job} saved={saved.has(job.id)} applied={applied.get(job.id) ?? null} />
            </li>
          ))}
        </ul>
      ) : (
        // bo'sh holat: soxta e'lon yo'q — aniq sabab va keyingi qadam
        <div className="mt-3 rounded-xl border border-border bg-card p-6 text-center">
          <SearchX className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-2 text-lg font-bold">{t("easy.start.empty_title")}</p>
          <p className="mx-auto mt-1 max-w-md text-muted-foreground">{t("easy.start.empty_desc")}</p>
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

/** Ro'yxat skeleti: yangi karta shakliga yaqin (matn qatorlari) — kontent kelganda sahifa siljimaydi */
function FeedSkeleton() {
  return (
    <div aria-hidden className="min-w-0 space-y-3">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-56" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2 rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex justify-between border-t border-border pt-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-11 w-36 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
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
        className="press flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 text-base font-semibold text-primary hover:border-primary/40"
      >
        {t("easy.start.all_professions")} <ChevronRight className="size-5 shrink-0" aria-hidden />
      </Link>
    );
  }
  const where = { region: place.region?.slug ?? "all", district: place.region ? (place.district?.id ?? "all") : null };
  return (
    <section aria-labelledby="home-professions">
      <div className="flex items-end justify-between gap-3">
        <h2 id="home-professions" className="text-base font-bold">
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
              className="press inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold hover:border-primary/40 hover:text-primary"
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

/** "O'zim haqimda e'lon": ish beruvchilar qidiruvda topadi (ikkilamchi, oq karta — ro'yxatdan ustun emas) */
async function ResumeCard() {
  const { t } = await getT();
  return (
    <Link href="/post/worker" className="press flex min-h-16 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:border-primary/40">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary" aria-hidden>
        <FileUser className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{t("easy.start.post_resume")}</span>
        <span className="block text-sm leading-snug text-muted-foreground">{t("easy.start.post_resume_desc")}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
