import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, BellRing, CalendarDays, ChevronRight, FileUser, GraduationCap, Laptop, LayoutGrid, MapPin, SearchX, Sprout } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import type { SessionContext } from "@/features/auth/session";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryIcon } from "@/components/shared/category-icon";
import { EMPTY_FIND, findHref } from "@/features/find/params";
import { JobResultCard } from "@/features/find/components/result-cards";
import { RetryButton } from "@/features/find/components/find-client";
import { ServiceTiles, type ServiceTile } from "@/components/shared/service-tiles";
import { cn } from "@/lib/utils";
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
import { getEntryStats } from "./entry-queries";
import { getEntryMedia } from "@/features/entry/queries";
import { entryMediaUrl } from "@/features/entry/media";
import { HeroBackdrop } from "@/components/shared/hero-backdrop";

/**
 * Ish qidiruvchi bosh sahifasi — mini-ilova uslubi (premium 2026-10; mehmon ham — ro'yxatdan o'tmasdan ko'radi):
 *  1) chuqur ko'k sarlavha: salomlashuv, "O'zingizga mos ishni toping", bugungi haqiqiy son, oq qidiruv kartasi va jonli AI qatori;
 *  2) sarlavha ustiga chiqib turadigan xizmatlar to'ri (yaltiroq belgilar): CV, kunlik, yaqin atrofda, masofaviy, tajribasiz,
 *     talabalar, Telegram xabar, barcha kasblar;
 *  3) darhol haqiqiy vakansiyalar (390×844 da birinchi vakansiyaning nomi, maoshi va hududi ko'rinadi).
 * Kompyuterda: sarlavha va xizmatlar keng, ostida ro'yxat (2 ustun) va o'ngda yordamchi panel. Telefonda panel ro'yxatdan keyin.
 */
export async function SeekerHome({ session, flush = false }: { session: SessionContext | null; flush?: boolean }) {
  const [{ t, name }, place, home, stats, media] = await Promise.all([getT(), getHomePlace(), getHomeSettings(), getEntryStats(), getEntryMedia()]);
  const photo = entryMediaUrl(media.hero_seeker);
  const where = { region: place.region?.slug ?? null, district: place.district?.id ?? null };
  const quick = Object.fromEntries(seekerQuickFilters(where).map((c) => [c.key, c.href])) as Record<"daily" | "noexp" | "remote" | "students", string>;
  const hasCv = !!session?.workerId;
  const firstName = session?.profile.first_name?.trim();
  const tiles: ServiceTile[] = [
    hasCv
      ? { key: "cv", href: "/profile/cv", label: t("easy.services.cv_mine"), hint: t("easy.services.cv_mine_hint"), icon: FileUser, tone: "violet", featured: true, track: "home_service" }
      : { key: "cv", href: "/post/worker", label: t("easy.services.cv"), hint: t("easy.services.cv_hint"), icon: FileUser, tone: "violet", featured: true, track: "home_service" },
    { key: "daily", href: quick.daily, label: t("easy.services.daily"), hint: t("easy.services.daily_hint"), icon: CalendarDays, tone: "orange", track: "home_service" },
    { key: "near", href: findHref(EMPTY_FIND, { mode: "jobs", near: true }), label: t("easy.services.near"), hint: t("easy.services.near_hint"), icon: MapPin, tone: "green", track: "home_service" },
    { key: "remote", href: quick.remote, label: t("easy.services.remote"), hint: t("easy.services.remote_hint"), icon: Laptop, tone: "cyan", track: "home_service" },
    { key: "noexp", href: quick.noexp, label: t("easy.services.noexp"), hint: t("easy.services.noexp_hint"), icon: Sprout, tone: "blue", track: "home_service" },
    { key: "students", href: quick.students, label: t("easy.services.students"), hint: t("easy.services.students_hint"), icon: GraduationCap, tone: "rose", track: "home_service" },
    { key: "alerts", href: "/ai-alerts", label: t("easy.services.alerts"), hint: t("easy.services.alerts_hint"), icon: BellRing, tone: "amber", track: "home_service" },
    { key: "all", href: findHref(EMPTY_FIND, { mode: "jobs" }), label: t("easy.services.all"), hint: t("easy.services.all_hint"), icon: LayoutGrid, tone: "indigo", track: "home_service" },
  ];
  return (
    <div className="space-y-6">
      <div>
        {/* flush — sahifaning eng tepasi (kirgan foydalanuvchi): telefonda sarlavha chetdan-chetga */}
        <section
          aria-labelledby="home-title"
          className={cn("hero-surface px-4 pb-16 pt-5 sm:rounded-2xl sm:px-6 sm:pt-6 lg:px-8 lg:pb-20 lg:pt-8", flush ? "-mx-4 -mt-4 sm:mx-0 sm:mt-0" : "rounded-2xl", photo && "has-photo")}
        >
          <HeroBackdrop src={photo} />
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-end lg:gap-10">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-hero-muted">{firstName ? t("easy.services.greeting", { name: firstName }) : t("easy.services.greeting_guest")}</p>
              <h1 id="home-title" className="mt-0.5 text-2xl font-extrabold leading-tight tracking-tight text-hero-fg sm:text-3xl lg:text-4xl">
                {t("easy.start.seeker_title")}
              </h1>
              {stats && stats.vacancies > 0 ? (
                <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-black/15 px-2.5 py-1 text-xs font-semibold text-hero-fg lg:hidden">
                  <span className="entry-live" aria-hidden />
                  {stats.today > 0 ? t("easy.services.today", { count: num(stats.today) }) : t("easy.services.total", { count: num(stats.vacancies) })}
                </p>
              ) : null}
              <div className="mt-4">
                <SeekerSearch
                  label={t("easy.start.search_label")}
                  placeholder={t("easy.start.search_placeholder")}
                  place={{ label: placeText(place, name, t("easy.location.whole_country")), href: placeChooserHref("jobs"), ...where }}
                  filtersHref={seekerFiltersHref(where)}
                  ai={home.aiButton}
                />
              </div>
            </div>
            {/* kompyuterda o'ngda: haqiqiy raqamlar (bazadan, ~10 daqiqada yangilanadi) — ishonch uchun, soxta "10 000+" yo'q */}
            {stats ? (
              <dl className="hero-glass hidden space-y-3 rounded-2xl p-4 lg:block">
                {(
                  [
                    ["stat_vacancies", stats.vacancies],
                    ["stat_today", stats.today],
                    ["stat_workers", stats.workers],
                  ] as const
                ).map(([key, value]) => (
                  <div key={key} className="flex items-baseline justify-between gap-3 border-b border-hero-fg/15 pb-2.5 last:border-0 last:pb-0">
                    <dt className="text-sm font-semibold text-hero-muted">{t(`welcome.market.${key}`)}</dt>
                    <dd className="tabular text-2xl font-extrabold text-hero-fg">{num(value)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </section>
        {/* xizmatlar sarlavha ustiga chiqib turadi */}
        <ServiceTiles items={tiles} label={t("easy.services.label")} className="relative z-10 -mt-11 lg:-mt-12 lg:mx-4" />
      </div>

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

const num = (n: number) => new Intl.NumberFormat("ru-RU").format(n);

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
