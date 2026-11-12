import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, BellRing, CalendarDays, ChevronRight, FileUser, Laptop, MapPin, SearchX, Sprout } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import type { SessionContext } from "@/features/auth/session";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EMPTY_FIND, findHref } from "@/features/find/params";
import { JobResultCard } from "@/features/find/components/result-cards";
import { RetryButton } from "@/features/find/components/find-client";
import { cn } from "@/lib/utils";
import { SeekerActivity } from "./seeker-dashboard";
import { savedIdSet } from "@/features/saved/queries";
import { myApplicationStatuses } from "@/features/applications/queries";
import { getHomeSettings } from "@/features/home-windows/queries";
import { SeekerSearch } from "./home-search";
import { AiFinder } from "@/features/find/components/ai-finder";
import { getHomePlace, getSeekerFeed, type HomePlace } from "./home-queries";
import { placeChooserHref, seekerFiltersHref, seekerQuickFilters } from "./quick-filters";
import { MyWorld } from "@/features/world/components/my-world";
import { MastersEntry } from "@/features/masters/components/masters-entry";
import { AiEntry } from "@/features/ai/components/ai-entry";
import { DemoVacanciesBlock } from "@/features/demo-vacancies/components/demo-block";

/** bosh sahifa ro'yxatida haqiqiy e'lon shundan kam bo'lsa — ostida namuna e'lonlar bloki */
const DEMO_BELOW = 4;

/**
 * Ish qidiruvchi bosh sahifasi — 2.0 (2026-11-11, egasi: "soddalashtir, umuman adashmasin"). Mehmon ham ko'radi.
 *  1) bitta savol va BITTA qidiruv maydoni: o'z so'zi bilan yozadi (o'zbek lotin/kirill, rus, xato bilan) — AI tushunadi va
 *     bazadan topadi; aniq topilmasa qidiruvni o'zi kengaytiradi va buni ochiq aytadi (src/features/find/ai-find.ts);
 *  2) 4 ta tez yo'l: kunlik ish, yaqin atrofda, masofaviy, tajribasiz;
 *  3) arizalar holati (kirgan ish izlovchi, ma'lumot bo'lsa);
 *  4) yangi ishlar ro'yxati; kompyuterda o'ngda — "O'zim haqimda e'lon" va "Yangi ish chiqsa xabar".
 *  5) kirgan foydalanuvchi — eng pastda "Mening dunyom" (qiziqishlari bo'yicha ishlar va bugungi reja): shaxsiy qism, birinchi
 *     ekranni band qilmaydi; mehmonga ko'rsatilmaydi.
 * Olib tashlandi: fon surati, nol ko'rsatkichlar, 8 ta plitka, bo'limlar, ommabop kasblar, katalog — bir ekranda bitta vazifa.
 * Admin AI'ni o'chirgan bo'lsa — oddiy matnli qidiruv (/search).
 */
export async function SeekerHome({ session, flush = false }: { session: SessionContext | null; flush?: boolean }) {
  const [{ t, name }, place, home] = await Promise.all([getT(), getHomePlace(), getHomeSettings()]);
  const where = { region: place.region?.slug ?? null, district: place.district?.id ?? null };
  const quick = Object.fromEntries(seekerQuickFilters(where).map((c) => [c.key, c.href])) as Record<"daily" | "noexp" | "remote" | "students", string>;
  const firstName = session?.profile.first_name?.trim();
  const shortcuts = [
    { key: "daily", href: quick.daily, label: t("easy.services.daily"), icon: CalendarDays },
    { key: "near", href: findHref(EMPTY_FIND, { mode: "jobs", near: true }), label: t("easy.services.near"), icon: MapPin },
    { key: "remote", href: quick.remote, label: t("easy.services.remote"), icon: Laptop },
    { key: "noexp", href: quick.noexp, label: t("easy.services.noexp"), icon: Sprout },
  ];
  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="home-title"
        data-home="seeker-v2"
        className={cn("border-border bg-card px-4 py-6 sm:rounded-2xl sm:border sm:px-8 sm:py-8", flush ? "-mx-4 -mt-4 border-b sm:mx-0 sm:mt-0" : "rounded-2xl border")}
      >
        <p className="text-sm font-medium text-muted-foreground">{firstName ? t("easy.services.greeting", { name: firstName }) : t("easy.services.greeting_guest")}</p>
        <h1 id="home-title" className="mt-1 text-2xl font-bold leading-tight tracking-tight text-navy dark:text-foreground sm:text-3xl">
          {t("easy.home2.title")}
        </h1>
        <p className="mt-1 text-base text-muted-foreground">{t("easy.home2.hint")}</p>
        <div className="mt-4 max-w-3xl">
          {home.aiButton ? (
            <AiFinder variant="field" defaultMode="jobs" locked fieldLabel={t("easy.home2.title")} placeholder={t("easy.home2.placeholder")} submitLabel={t("easy.home2.submit")} />
          ) : (
            <SeekerSearch
              label={t("easy.start.search_label")}
              placeholder={t("easy.start.search_placeholder")}
              place={{ label: placeText(place, name, t("easy.location.whole_country")), href: placeChooserHref("jobs"), ...where }}
              filtersHref={seekerFiltersHref(where)}
              ai={false}
            />
          )}
        </div>
        <nav aria-label={t("easy.home2.shortcuts")} className="mt-4">
          <ul className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {shortcuts.map(({ key, href, label, icon: Icon }) => (
              <li key={key} className="flex">
                <Link
                  href={href}
                  prefetch={false}
                  data-track="home_service"
                  data-track-to={key}
                  className="press inline-flex min-h-11 w-full items-center gap-2 rounded-md border border-border bg-background px-3.5 text-sm font-semibold hover:border-primary/50 hover:text-primary-ink"
                >
                  <Icon className="size-4 shrink-0 text-primary-ink" aria-hidden /> {label}
                </Link>
              </li>
            ))}
          </ul>
          {/* "direction_select" — admin tahlilidagi voronka qadami (avval "Barcha kasblar" havolasida edi) */}
          <Link href={seekerFiltersHref(where)} prefetch={false} data-track="direction_select" className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary-ink hover:underline">
            {t("easy.home2.all_filters")} <ChevronRight className="size-4" aria-hidden />
          </Link>
        </nav>
        {/* alohida bo'limlar: "AI yordamchi" (suhbat oynasi, /ai) va "Universal ustalar" (turkuaz) — bir qatorda; telefonda ixcham
            plitka (faqat nom): birinchi e'lon birinchi ekranda qolsin (home.spec) */}
        <div className="mt-3 grid max-w-3xl grid-cols-2 gap-2" data-home-sections>
          <AiEntry dense title={t("easy.aiws.nav.ai")} desc={t("easy.aiws.entry_desc")} />
          <MastersEntry dense title={t("masters.name")} desc={t("masters.entry_desc")} />
        </div>
      </section>

      {/* kirgan ish izlovchi: arizalar holati va saqlanganlar (faqat ma'lumot bo'lsa) */}
      {session?.workerId ? (
        <Suspense fallback={null}>
          <SeekerActivity workerId={session.workerId} />
        </Suspense>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Suspense fallback={<FeedSkeleton />}>
          <SeekerFeed session={session} place={place} />
        </Suspense>
        <aside aria-label={t("easy.start.more_title")} className="min-w-0 space-y-3">
          <ResumeCard />
          <AlertCard />
        </aside>
      </div>

      {/* shaxsiy qism — faqat kirgan foydalanuvchiga, ro'yxatdan keyin (birinchi ekran: qidiruv va yangi ishlar) */}
      {session ? (
        <Suspense fallback={null}>
          <MyWorld session={session} />
        </Suspense>
      ) : null}
    </div>
  );
}

/** "Yangi ish chiqsa — Telegram'da xabar": o'z so'zi bilan kuzatuv (AI) */
async function AlertCard() {
  const { t } = await getT();
  return (
    <Link href="/ai-alerts?role=worker" className="press flex min-h-16 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:border-primary/40">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-ink" aria-hidden>
        <BellRing className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{t("easy.home2.alert_title")}</span>
        <span className="block text-sm leading-snug text-muted-foreground">{t("easy.home2.alert_desc")}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
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
          <Link href={feed.allHref} className="-my-2 inline-flex min-h-11 shrink-0 items-center gap-0.5 text-base font-semibold text-primary-ink hover:underline">
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
      {/* haqiqiy e'lon yo'q yoki juda kam: ostida "Namuna e'lonlar" (alohida jadval, "Namuna" belgisi bilan) — ilova bo'sh
          ko'rinmasin. Haqiqiy e'lonlar ko'paygach bu blok chizilmaydi; namunalar olib tashlangan bo'lsa ham */}
      {feed.items.length < DEMO_BELOW ? (
        <Suspense fallback={null}>
          <DemoVacanciesBlock region={place.region?.slug ?? null} limit={6} className="mt-6" columns="md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2" />
        </Suspense>
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

/** "O'zim haqimda e'lon": ish beruvchilar qidiruvda topadi (ikkilamchi, oq karta — ro'yxatdan ustun emas) */
async function ResumeCard() {
  const { t } = await getT();
  return (
    <Link href="/post/worker" className="press flex min-h-16 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:border-primary/40">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-ink" aria-hidden>
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
