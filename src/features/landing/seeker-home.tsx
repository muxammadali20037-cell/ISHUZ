import { Suspense } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  FileText,
  ChevronDown,
  ChevronRight,
  MapPin,
  Plus,
  SearchX,
} from "lucide-react";
import { getT } from "@/lib/i18n/server";
import type { SessionContext } from "@/features/auth/session";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { JobResultCard } from "@/features/find/components/result-cards";
import { RetryButton } from "@/features/find/components/find-client";
import { cn } from "@/lib/utils";
import { savedIdSet } from "@/features/saved/queries";
import { myApplicationStatuses } from "@/features/applications/queries";
import { getHomeSettings } from "@/features/home-windows/queries";
import { TopSearch } from "@/features/find/components/top-search";
import { getHomePlace, getSeekerFeed, type HomePlace } from "./home-queries";
import { homeMenuLinks, placeChooserHref, seekerFiltersHref } from "./quick-filters";
import { MastersHomeSection } from "@/features/masters/components/masters-home-section";
import { DemoVacanciesBlock } from "@/features/demo-vacancies/components/demo-block";
import { StoriesRow } from "@/features/stories/components/stories-row";
import { HomeMenu } from "./home-menu";
import { HomeLinkRow } from "./home-link-row";
import { countMyListings } from "@/features/cabinet/queries";
import { jobsHref } from "@/features/jobs/search-params";

/** bosh sahifa ro'yxatida haqiqiy e'lon shundan kam bo'lsa — ostida namuna e'lonlar bloki */
const DEMO_BELOW = 4;

/**
 * Ish qidiruvchi bosh sahifasi — 3.0 (2026-11-13, ega: "bosh sahifada faqat eng muhim narsalar qolsin: joylashuv, salomlashuv,
 * katta qidiruv, tezkor kategoriyalar, yangi ish e'lonlari, alohida Universal ustalar"). Mehmon ham ko'radi.
 *  1) joylashuv (telefonda — yuqori panelda, kompyuterda — shu yerda) va salomlashuv;
 *  2) bitta savol va BITTA qidiruv maydoni: o'z so'zi bilan yozadi — AI tushunadi va bazadan topadi (src/features/find/ai-find.ts);
 *  3) yangi ishlar ro'yxati (to'liq kenglikda; kirganda telefonda yig'ilgan);
 *  4) "Bo'limlar" (2026-11-17, ega): Universal ustalar, Barcha vakansiyalar, Yordamchi, Kunlik, Masofaviy, Tajribasiz, Yaqin
 *     atrofdan… — bitta ustunda qator bo'lib (avvalgi 4 ta tez yo'l plitkasi shu yerga ko'chdi); mehmon ham ko'radi;
 *  5) "Universal ustalar" — kompyuterda o'z yashil rangida, alohida bo'lim.
 * "Mening dunyom" — 2026-11-17 olib tashlandi (ega); arizalar holati — "Arizalar" bo'limi va profil sarlavhasi;
 * "Yangi ish chiqsa xabar" — Profil → PRO kuzatuv; Yordamchi — yuqori panel (✨) va bo'limlar.
 * Admin AI'ni o'chirgan bo'lsa — oddiy matnli qidiruv (/search).
 */
export async function SeekerHome({
  session,
}: {
  session: SessionContext | null;
  flush?: boolean;
}) {
  const [{ t, name }, place, home] = await Promise.all([
    getT(),
    getHomePlace(),
    getHomeSettings(),
  ]);
  const where = {
    region: place.region?.slug ?? null,
    district: place.district?.id ?? null,
  };
  const firstName = session?.profile.first_name?.trim();
  return (
    <div className="flex flex-col gap-6">
      {/* bosh qism: joylashuv · salomlashuv · sarlavha · qidiruv · "+ E'lon joylash" · havolalar. Ega (2026-11-17): "oyna ustida
          oyna turibdi — olib tashla" — tashqi oq karta yo'q (qidiruv maydoni o'zi alohida quti); sarlavha bitta qatorga sig'adi */}
      <section
        aria-labelledby="home-title"
        data-home="seeker-v2"
        className="relative px-1 pt-1 sm:px-2"
      >
        {/* @container: sarlavha o'lchami shu kenglikka qarab (cqw) — telefonda bitta qator */}
        <div className="@container min-w-0">
          {/* "Ish Topdim" hikoyalari — eng tepada, kichik doirachalar (bo'lmasa — joy ham qolmaydi) */}
          <Suspense fallback={null}>
            <StoriesRow mode="seeker" className="mb-4" />
          </Suspense>
          <Link
            href={placeChooserHref("jobs")}
            prefetch={false}
            data-home-place
            aria-label={t("easy.start.place_label", { place: placeText(place, name, t("easy.location.whole_country")) })}
            className="press inline-flex h-11 max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-4 text-sm font-semibold hover:border-primary/40"
          >
            <MapPin className="size-4 shrink-0 text-primary-ink" aria-hidden />
            <span className="truncate">{placeText(place, name, t("easy.location.whole_country"))}</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
          <p className="mt-4 text-sm font-medium text-muted-foreground sm:mt-6">
            {firstName ? t("easy.services.greeting", { name: firstName }) : t("easy.services.greeting_guest")}
          </p>
          <h1 id="home-title" className="mt-1 text-[min(1.75rem,8.2cqw)] font-extrabold leading-[1.1] tracking-tight sm:mt-1.5 sm:text-[min(3rem,8.2cqw)] lg:text-[min(3.5rem,8.2cqw)]">
            {t("easy.home2.title_a")}
            <span className="brand-text">{t("easy.home2.title_em")}</span>
            {t("easy.home2.title_b")}
          </h1>
          {/* qidiruv: AI yoqilgan bo'lsa — Yordamchi (oddiy so'z bilan), aks holda — oddiy matnli qidiruv (/search) */}
          <div className="mt-4 max-w-2xl sm:mt-6">
            <TopSearch mode="jobs" ai={home.aiButton} hero />
          </div>
          {/* qidiruv ostida "+ E'lon joylash" — o'zi haqida e'lon (ish beruvchilar topadi). Ega (2026-11-17, ikkinchi):
              "juda katta bo'lib ketgan — ingichka va kichikroq bo'lsin": 44 px, och ko'k (qidiruvdagi "Izlash" bilan raqobat qilmaydi) */}
          <div className="mt-2.5 max-w-2xl">
            <Link
              href="/ai/post"
              prefetch={false}
              data-track="post_start"
              data-track-to="home_hero"
              data-home-post
              className="press flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary-soft px-4 text-base font-bold text-primary-ink hover:bg-primary/15"
            >
              <Plus className="size-5" strokeWidth={2.6} aria-hidden />
              {t("easy.home2.post_cta")}
            </Link>
          </div>
          <div className={cn("mt-2 flex flex-wrap gap-x-6", session && "max-lg:hidden")}>
            <Link
              href={seekerFiltersHref(where)}
              prefetch={false}
              data-track="direction_select"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary-ink hover:underline"
            >
              {t("easy.home2.all_filters")}{" "}
              <ChevronRight className="size-4" aria-hidden />
            </Link>
            {/* yaqin atrofdagi ishlar — Yandex xaritasida (eslab qolingan hudud bilan) */}
            <Link
              href={
                place.region
                  ? `/jobs/xarita?region=${encodeURIComponent(place.region.slug)}${place.district ? `&district=${place.district.id}` : ""}`
                  : "/jobs/xarita"
              }
              prefetch={false}
              data-track="home_service"
              data-track-to="map"
              data-map-entry
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary-ink hover:underline"
            >
              <MapPin className="size-4" aria-hidden /> {t("map.entry")}
              <span className="live-dot ml-0.5 size-2 rounded-full bg-primary" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* kirgan (telefon va planshet): "E'lonlarim" — o'zi joylagan e'lonlar va holati (alohida sahifa; ega, 2026-11-17) */}
      {session ? (
        <div className="-mt-2 lg:hidden">
          <Suspense fallback={<MyListingsRow />}>
            <MyListingsRowCounted session={session} />
          </Suspense>
        </div>
      ) : null}
      {/* "Yangi ishlar": kirganda telefonda — qator-havola (yangi joylangan e'lonlar sahifasi); kompyuterda va mehmonda — ro'yxat */}
      <Suspense
        fallback={
          session ? (
            <>
              <div className="-mt-2 h-16 animate-pulse rounded-2xl bg-secondary lg:hidden" aria-hidden />
              <div className="max-lg:hidden"><FeedSkeleton /></div>
            </>
          ) : (
            <FeedSkeleton />
          )
        }
      >
        <SeekerFeed session={session} place={place} fold={!!session} />
      </Suspense>

      {/* bo'limlar (ega, 2026-11-17): Universal ustalar, Barcha vakansiyalar, Yordamchi, Kunlik, Masofaviy, Tajribasiz, Yaqin
          atrofdan… — hammasi bir qatorda; avvalgi 4 ta plitka shu yerga ko'chdi. Mehmon ham ko'radi */}
      <Suspense fallback={null}>
        <HomeMenu
          mode="worker"
          guest={!session}
          links={homeMenuLinks("worker", where)}
        />
      </Suspense>

      {/* "Universal ustalar" — ish e'lonlaridan alohida, o'z yashil rangida (telefonda — bo'limlar ro'yxatida) */}
      <div className="max-lg:hidden">
        <Suspense fallback={null}>
          <MastersHomeSection />
        </Suspense>
      </div>
    </div>
  );
}

type NameFn = (
  row:
    | {
        name_uz: string;
        name_ru: string;
        name_en?: string | null;
        name_oz?: string | null;
      }
    | null
    | undefined,
) => string;

function placeText(
  place: Pick<HomePlace, "region" | "district">,
  name: NameFn,
  whole: string,
): string {
  if (!place.region) return whole;
  return place.district
    ? `${name(place.region)} · ${name(place.district)}`
    : name(place.region);
}

async function SeekerFeed({
  session,
  place,
  fold = false,
}: {
  session: SessionContext | null;
  place: HomePlace;
  /** kirgan foydalanuvchi: telefonda yig'ilgan ("Yangi ishlar — Ko'rish"), kompyuterda ochiq */
  fold?: boolean;
}) {
  const [{ t, name }, feed] = await Promise.all([
    getT(),
    getSeekerFeed(session, place),
  ]);
  if (!feed.ok) {
    return (
      <section
        role="alert"
        aria-labelledby="home-feed"
        className="space-y-3 rounded-xl border border-warning/40 bg-warning-soft p-5 text-center"
      >
        <h2 id="home-feed" className="text-lg font-bold">
          {t("easy.start.list_error_title")}
        </h2>
        <p className="text-muted-foreground">
          {t("easy.start.list_error_desc")}
        </p>
        <div className="mx-auto grid max-w-sm">
          <RetryButton label={t("easy.search.retry")} />
        </div>
        <p className="text-sm text-muted-foreground">
          {t("easy.search.error_code", { code: feed.errorId })}
        </p>
      </section>
    );
  }
  const ids = feed.items.map((i) => i.id);
  const [saved, applied] = await Promise.all([
    savedIdSet(session, "vacancy", ids),
    myApplicationStatuses(session?.workerId ?? null, ids),
  ]);
  const where = placeText(feed, name, t("easy.location.whole_country"));
  const more = feed.total > feed.items.length;
  const title = feed.kind === "match" ? t("easy.start.match_title") : t("easy.start.new_title");
  const body = (
    <section aria-labelledby="home-feed" className="min-w-0">
      <div className={cn("flex items-baseline justify-between gap-3", fold && "max-lg:hidden")}>
        <h2 id="home-feed" className="min-w-0 text-2xl font-extrabold leading-tight tracking-tight">
          {title}
        </h2>
        {more ? (
          <Link
            href={feed.allHref}
            className="-my-2 inline-flex min-h-11 shrink-0 items-center gap-0.5 text-base font-semibold text-primary-ink hover:underline"
          >
            {t("easy.start.see_all")}{" "}
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
      {/* nega aynan shu ro'yxat: kasb va hudud (soxta foiz yo'q) */}
      <p className="mt-1 text-sm text-muted-foreground">
        {feed.kind === "match"
          ? t("easy.start.match_reason", {
              profession: name(feed.profession),
              place: where,
            })
          : t("easy.start.new_reason", { place: where })}
      </p>
      {feed.noMatchFor ? (
        <p className="mt-2 rounded-lg bg-secondary px-3 py-2 text-sm">
          {t("easy.start.no_match_note", { profession: name(feed.noMatchFor) })}
        </p>
      ) : null}
      {feed.items.length ? (
        // 5.0: 3 ustun (planshet 2, telefon 1), oraliq 16 px
        <ul className="pop-list mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 4xl:grid-cols-4">
          {feed.items.map((job) => (
            <li key={job.id} className="flex [&>article]:w-full">
              <JobResultCard
                job={job}
                saved={saved.has(job.id)}
                applied={applied.get(job.id) ?? null}
              />
            </li>
          ))}
        </ul>
      ) : (
        // bo'sh holat: soxta e'lon yo'q — aniq sabab va keyingi qadam
        <div className="mt-3 rounded-xl border border-border bg-card p-6 text-center">
          <SearchX
            className="mx-auto size-8 text-muted-foreground"
            aria-hidden
          />
          <p className="mt-2 text-lg font-bold">
            {t("easy.start.empty_title")}
          </p>
          <p className="mx-auto mt-1 max-w-md text-muted-foreground">
            {t("easy.start.empty_desc")}
          </p>
          <Button asChild className="mt-4 h-12 px-5 text-base">
            <Link href="/post/worker">{t("easy.start.post_resume")}</Link>
          </Button>
        </div>
      )}
      {more ? (
        <Button
          asChild
          variant="outline"
          className="mt-3 h-12 w-full text-base font-semibold"
        >
          <Link href={feed.allHref}>
            {t("easy.start.all_jobs", {
              count: feed.total >= 5000 ? "5 000+" : feed.total,
            })}{" "}
            <ArrowRight className="size-5" aria-hidden />
          </Link>
        </Button>
      ) : null}
      {/* haqiqiy e'lon yo'q yoki juda kam: ostida "Namuna e'lonlar" (alohida jadval, "Namuna" belgisi bilan) — ilova bo'sh
          ko'rinmasin. Haqiqiy e'lonlar ko'paygach bu blok chizilmaydi; namunalar olib tashlangan bo'lsa ham */}
      {feed.items.length < DEMO_BELOW ? (
        <Suspense fallback={null}>
          <DemoVacanciesBlock
            region={place.region?.slug ?? null}
            limit={6}
            className="mt-6"
            columns="md:grid-cols-2 lg:grid-cols-3"
          />
        </Suspense>
      ) : null}
    </section>
  );
  if (!fold) return body;
  // kirgan foydalanuvchi, telefonda — bitta qator: bosilsa yangi joylangan e'lonlar sahifasi ochiladi (shu yerda ochilmaydi;
  // ega, 2026-11-17). "Sizga mos ishlar" — kasb bo'yicha natijalar. Kompyuterda — ro'yxat shu yerda
  const rowHref =
    feed.kind === "new"
      ? jobsHref({ sort: "newest", region: feed.region?.slug ?? null, district: feed.district ? [feed.district.id] : [] })
      : feed.allHref;
  return (
    <>
      <HomeLinkRow
        name="new-jobs"
        href={rowHref}
        icon={<BriefcaseBusiness />}
        title={title}
        hint={feed.kind === "match" && feed.profession ? name(feed.profession) : t("easy.home2.new_jobs_hint")}
        count={feed.total || null}
        className="-mt-2 lg:hidden"
      />
      <div className="max-lg:hidden">{body}</div>
    </>
  );
}

/** "E'lonlarim" qatori (sonsiz — yuklanayotganda yoki xatoda) */
async function MyListingsRow({ count = null }: { count?: number | null }) {
  const { t } = await getT();
  return (
    <HomeLinkRow
      name="my-listings"
      href="/cabinet/elonlar"
      icon={<FileText />}
      title={t("easy.home2.my_listings")}
      hint={t("easy.home2.my_listings_hint")}
      count={count}
    />
  );
}

async function MyListingsRowCounted({ session }: { session: SessionContext }) {
  return <MyListingsRow count={await countMyListings(session)} />;
}

/** Ro'yxat skeleti: yangi karta shakliga yaqin (matn qatorlari) — kontent kelganda sahifa siljimaydi */
function FeedSkeleton() {
  return (
    <div aria-hidden className="min-w-0 space-y-3">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-56" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 4xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="space-y-2 rounded-xl border border-border bg-card p-4"
          >
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
