import { Suspense } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  ChevronRight,
  Eye,
  Laptop,
  LocateFixed,
  MapPin,
  Megaphone,
  Phone,
  Send,
  ShieldCheck,
  Sprout,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { getT } from "@/lib/i18n/server";
import type { SessionContext } from "@/features/auth/session";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EMPTY_FIND, findHref } from "@/features/find/params";
import { JobResultCard } from "@/features/find/components/result-cards";
import { RetryButton } from "@/features/find/components/find-client";
import { savedIdSet } from "@/features/saved/queries";
import { myApplicationStatuses } from "@/features/applications/queries";
import { WindowArtwork } from "@/features/home-windows/window-art";
import type { WindowArt } from "@/features/home-windows/model";
import { enterMode } from "@/features/mode/actions";
import type { AppMode } from "@/features/mode/mode";
import { HomeSearch } from "./home-search";
import { getHomePlace, getSeekerFeed, type HomePlace } from "./home-queries";
import { employerQuickFilters, placeChooserHref, seekerQuickFilters } from "./quick-filters";
import { getEntryStats, type EntryStats } from "./entry-queries";
import { TileButton } from "./entry-client";

const LATEST = 5;
const num = (n: number) => new Intl.NumberFormat("ru-RU").format(n);

/**
 * Kirish oynasi — rejim hali tanlanmagan (mehmon yoki yangi foydalanuvchi). Yandex Go kabi: avval maqsad.
 *  1) katta oyna: bugungi yangi e'lonlar (haqiqiy son), "Nima qidiryapsiz?" va ikki katta plitka — "Ish topaman" / "Ishchi topaman";
 *  2) qidiruv — darhol ishlaydi (ro'yxatdan o'tish shart emas);
 *  3) tez kirish: ikki qator kichik plitka (kunlik, masofaviy, tajribasiz, yaqin | ishchilar, tajribali, yaqin, e'lon berish);
 *  4) yangi vakansiyalar — haqiqiy kartalar; 5) nega Ish topdim; 6) "Hisobingiz bormi? Kirish".
 * Har bir plitka — forma: rejim yoziladi va shu bo'limga o'tiladi (keyingi safar to'g'ridan-to'g'ri o'z bosh sahifasi).
 * Sonlar xato bo'lsa ko'rsatilmaydi (soxta raqam yo'q).
 */
export async function EntryHome({ session }: { session: SessionContext | null }) {
  const [{ t, name }, place, stats] = await Promise.all([getT(), getHomePlace(), getEntryStats()]);
  const where = { region: place.region?.slug ?? null, district: place.district?.id ?? null };
  const seek = Object.fromEntries(seekerQuickFilters(where).map((f) => [f.key, f.href])) as Record<"salary" | "noexp" | "daily" | "remote", string>;
  const hire = Object.fromEntries(employerQuickFilters(where).map((f) => [f.key, f.href])) as Record<"experienced" | "near", string>;
  const placeLabel = place.region ? (place.district ? `${name(place.region)} · ${name(place.district)}` : name(place.region)) : t("easy.location.whole_country");
  const allWorkers = findHref(EMPTY_FIND, { mode: "workers", any: true, region: where.region ?? "all", district: where.region ? (where.district ?? "all") : null });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <EntryHero stats={stats} />

      <HomeSearch scope="jobs" label={t("welcome.entry.search_label")} placeholder={t("welcome.entry.search_placeholder")} place={{ label: placeLabel, href: placeChooserHref("jobs") }} chips={[]} />

      <section aria-labelledby="entry-quick" className="space-y-4">
        <h2 id="entry-quick" className="sr-only">
          {t("welcome.entry.quick_label")}
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
        <QuickRow
          title={t("welcome.entry.for_seekers")}
          mode="worker"
          items={[
            { key: "daily", icon: CalendarDays, label: t("welcome.entry.q_daily"), next: seek.daily },
            { key: "remote", icon: Laptop, label: t("welcome.entry.q_remote"), next: seek.remote },
            { key: "noexp", icon: Sprout, label: t("welcome.entry.q_noexp"), next: seek.noexp },
            { key: "near", icon: MapPin, label: t("welcome.entry.q_near"), next: findHref(EMPTY_FIND, { mode: "jobs", near: true }) },
          ]}
        />
        <QuickRow
          title={t("welcome.entry.for_employers")}
          mode="employer"
          items={[
            { key: "workers", icon: UsersRound, label: t("welcome.entry.q_workers"), next: allWorkers },
            { key: "experienced", icon: BadgeCheck, label: t("welcome.entry.q_experienced"), next: hire.experienced },
            { key: "near_workers", icon: LocateFixed, label: t("welcome.entry.q_near_workers"), next: hire.near },
            { key: "post", icon: Megaphone, label: t("welcome.entry.q_post"), next: "/post/vacancy" },
          ]}
        />
        </div>
      </section>

      <Suspense fallback={<LatestSkeleton />}>
        <EntryLatest session={session} place={place} />
      </Suspense>

      <Perks />

      {session ? null : (
        <p className="flex flex-wrap items-center justify-center gap-x-2 text-base text-muted-foreground">
          {t("welcome.entry.have_account")}
          <Link href="/auth" className="inline-flex min-h-11 items-center px-1 font-bold text-primary hover:underline">
            {t("welcome.entry.login")}
          </Link>
        </p>
      )}
    </div>
  );
}

/** Katta oyna: jonli son, savol va ikki asosiy maqsad. Ilovaning o'z ranglari: yumshoq ko'k fon, oq plitkalar, ko'k urg'u */
async function EntryHero({ stats }: { stats: EntryStats | null }) {
  const { t } = await getT();
  return (
    <section aria-labelledby="entry-title" className="relative isolate overflow-hidden rounded-2xl border border-primary/15 bg-primary-soft p-4 sm:p-6">
      {/* bezak doiralar */}
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 -z-10 size-56 rounded-full bg-primary/10" />
      <span aria-hidden className="pointer-events-none absolute -bottom-24 -left-10 -z-10 size-48 rounded-full bg-card/40" />
      {stats && stats.today > 0 ? (
        <p className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-sm font-semibold shadow-sm">
          <span className="entry-live" aria-hidden />
          {t("welcome.entry.today", { count: num(stats.today) })}
        </p>
      ) : null}
      <h1 id="entry-title" className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
        {t("welcome.entry.title")}
      </h1>
      <p className="mt-1 text-base text-muted-foreground">{t("welcome.entry.subtitle")}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <RoleTile
          mode="worker"
          art="jobs"
          title={t("welcome.entry.worker_tile")}
          hint={stats && stats.vacancies > 0 ? t("welcome.entry.worker_hint", { count: num(stats.vacancies) }) : t("welcome.entry.worker_hint_empty")}
        />
        <RoleTile
          mode="employer"
          art="workers"
          title={t("welcome.entry.employer_tile")}
          hint={stats && stats.workers > 0 ? t("welcome.entry.employer_hint", { count: num(stats.workers) }) : t("welcome.entry.employer_hint_empty")}
        />
      </div>
    </section>
  );
}

function RoleTile({ mode, art, title, hint }: { mode: AppMode; art: WindowArt; title: string; hint: string }) {
  return (
    <form action={enterMode} className="flex">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="next" value="/" />
      <TileButton
        data-track="entry_role"
        data-track-to={mode}
        className="press lift flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm hover:border-primary/50"
      >
        <span className="relative block aspect-[16/10] w-full sm:aspect-[16/7]" aria-hidden>
          <WindowArtwork art={art} cover />
          <span className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-card text-primary shadow-sm">
            <ArrowRight className="size-4" />
          </span>
        </span>
        <span className="flex flex-1 flex-col p-3">
          <span className="block text-base font-extrabold leading-tight min-[400px]:text-lg">{title}</span>
          <span className="mt-1 block text-sm leading-snug text-muted-foreground">{hint}</span>
        </span>
      </TileButton>
    </form>
  );
}

interface QuickItem {
  key: string;
  icon: LucideIcon;
  label: string;
  next: string;
}

/** Kichik plitkalar qatori (Yandex Go'dagi belgilar qatori kabi): bosilganda rejim yoziladi va natijalar ochiladi */
function QuickRow({ title, mode, items }: { title: string; mode: AppMode; items: QuickItem[] }) {
  return (
    <div>
      <p className="mb-2 text-sm font-bold text-muted-foreground">{title}</p>
      <ul className="grid grid-cols-4 gap-1.5 min-[400px]:gap-2">
        {items.map((it) => (
          <li key={it.key} className="flex">
            <form action={enterMode} className="flex w-full">
              <input type="hidden" name="mode" value={mode} />
              <input type="hidden" name="next" value={it.next} />
              <TileButton
                data-track="entry_quick"
                data-track-to={it.key}
                className="press flex w-full flex-col items-center gap-1.5 rounded-2xl border border-border bg-card px-1 pb-2 pt-2.5 text-center hover:border-primary/50"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary" aria-hidden>
                  <it.icon className="size-5" />
                </span>
                {/* tor telefonda (rus tilida "Подработка", "Разместить") so'z bo'linmasin — harf biroz kichikroq */}
                <span className="text-xs font-semibold leading-tight max-[379px]:text-2xs max-[379px]:tracking-tight">{it.label}</span>
              </TileButton>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Yangi vakansiyalar — haqiqiy kartalar (mehmon ham ko'radi, telefon — ruxsatga qarab) */
async function EntryLatest({ session, place }: { session: SessionContext | null; place: HomePlace }) {
  const [{ t, name }, feed] = await Promise.all([getT(), getSeekerFeed(null, place)]);
  if (!feed.ok) {
    return (
      <section role="alert" aria-labelledby="entry-latest" className="space-y-3 rounded-2xl border border-warning/40 bg-warning-soft p-5 text-center">
        <h2 id="entry-latest" className="text-xl font-bold">
          {t("welcome.entry.latest_error")}
        </h2>
        <div className="mx-auto grid max-w-sm">
          <RetryButton label={t("easy.search.retry")} />
        </div>
        <p className="text-sm text-muted-foreground">{t("easy.search.error_code", { code: feed.errorId })}</p>
      </section>
    );
  }
  const items = feed.items.slice(0, LATEST);
  const ids = items.map((i) => i.id);
  const [saved, applied] = await Promise.all([savedIdSet(session, "vacancy", ids), myApplicationStatuses(session?.workerId ?? null, ids)]);
  const where = feed.region ? (feed.district ? `${name(feed.region)} · ${name(feed.district)}` : name(feed.region)) : t("easy.location.whole_country");
  return (
    <section aria-labelledby="entry-latest">
      <div className="flex items-center justify-between gap-3">
        <h2 id="entry-latest" className="min-w-0 text-xl font-bold leading-tight">
          {t("welcome.entry.latest_title")}
        </h2>
        {feed.total > items.length ? (
          <Link href={feed.allHref} className="-my-2 inline-flex min-h-11 shrink-0 items-center gap-1 text-base font-semibold text-primary hover:underline">
            {t("welcome.entry.latest_all")} <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
      <p className="mt-0.5 text-sm text-muted-foreground">{t("easy.start.new_reason", { place: where })}</p>
      {items.length ? (
        <ul className="pop-list mt-3 grid grid-cols-1 gap-3">
          {items.map((job) => (
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
        <p className="mt-3 rounded-2xl border border-dashed border-border bg-card p-5 text-center text-muted-foreground">{t("welcome.entry.latest_empty")}</p>
      )}
      {feed.total > items.length ? (
        <Button asChild variant="outline" className="mt-3 h-12 w-full text-base font-semibold">
          <Link href={feed.allHref}>
            {t("welcome.entry.latest_more", { count: feed.total >= 5000 ? "5 000+" : num(feed.total) })} <ArrowRight className="size-5" aria-hidden />
          </Link>
        </Button>
      ) : null}
    </section>
  );
}

function LatestSkeleton() {
  return (
    <div aria-hidden className="space-y-3">
      <Skeleton className="h-6 w-44" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <div className="flex gap-3">
            <Skeleton className="size-12 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Nega Ish topdim — faqat ilovada haqiqatan ishlaydigan narsalar (raqamsiz va'da yo'q) */
async function Perks() {
  const { t } = await getT();
  const perks = [
    { icon: Eye, label: t("welcome.entry.perk_browse") },
    { icon: Phone, label: t("welcome.entry.perk_call") },
    { icon: Send, label: t("welcome.entry.perk_telegram") },
    { icon: ShieldCheck, label: t("welcome.entry.perk_verified") },
  ];
  return (
    <section aria-labelledby="entry-perks">
      <h2 id="entry-perks" className="mb-2 text-lg font-bold">
        {t("welcome.entry.perks_label")}
      </h2>
      <ul className="grid grid-cols-2 gap-2">
        {perks.map((p) => (
          <li key={p.label} className="flex items-center gap-2.5 rounded-2xl bg-secondary px-3 py-3 text-sm font-semibold leading-snug">
            <p.icon className="size-5 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0">{p.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
