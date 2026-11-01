import { Fragment, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, CalendarDays, CheckCircle2, Laptop, MapPin, Search, Sparkles, Sprout, UsersRound, type LucideIcon } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { AiFinder } from "@/features/find/components/ai-finder";
import { JobPeekRow } from "@/features/find/components/result-cards";
import { findJobs } from "@/features/find/queries";
import { getRegions } from "@/lib/reference";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EMPTY_FIND, findHref } from "@/features/find/params";
import { enterMode } from "@/features/mode/actions";
import type { AppMode } from "@/features/mode/mode";
import type { EntryMedia } from "@/features/entry/media";
import { Photo } from "@/components/shared/photo";
import { cn } from "@/lib/utils";
import { entryMediaUrl } from "@/features/entry/media";
import { TileButton } from "../entry-client";
import { seekerQuickFilters } from "../quick-filters";
import type { EntryStats } from "../entry-queries";
import { latestTabFind } from "./model";
import { homeSearch } from "./actions";

const num = (n: number) => new Intl.NumberFormat("ru-RU").format(n);

/**
 * Bosh sahifaning birinchi ekrani (2026-11 redizayn — "Jobio" uslubi): oq fon, katta sarlavha (oxirgi qatori — ko'k urg'u),
 * bir jumlali tushuntirish, ikki aniq yo'l ("Ish qidiraman" / "Ish beruvchiman" — rejim yoziladi), haqiqiy raqamlar.
 * Kompyuterda o'ngda — katta ko'k doira ustida admin yuklagan surat (home_photo) yoki, surat bo'lmasa, HAQIQIY yangi
 * vakansiyalar ro'yxati (bosiladi). Qidiruv paneli hero chegarasida turadi (yarmi oq fonda, yarmi sahifa fonida).
 * Hech qanday soxta avatar, raqam yoki "AI moslik" yo'q: son 0 yoki xato bo'lsa — ko'rsatilmaydi.
 */
export async function MarketHero({ stats, media, ai = false }: { stats: EntryStats | null; media: EntryMedia; ai?: boolean }) {
  const { t } = await getT();
  const photo = entryMediaUrl(media.home_photo);
  const seek = Object.fromEntries(seekerQuickFilters({ region: null, district: null }).map((f) => [f.key, f.href])) as Record<"salary" | "noexp" | "daily" | "remote", string>;
  const chips: { key: string; icon: LucideIcon; label: string; next: string }[] = [
    { key: "daily", icon: CalendarDays, label: t("welcome.market.q_daily"), next: seek.daily },
    { key: "noexp", icon: Sprout, label: t("welcome.market.q_noexp"), next: seek.noexp },
    { key: "remote", icon: Laptop, label: t("welcome.market.q_remote"), next: seek.remote },
    { key: "new", icon: Sparkles, label: t("welcome.market.q_new"), next: "/jobs?sort=newest" },
    { key: "near", icon: MapPin, label: t("welcome.market.q_near"), next: findHref(EMPTY_FIND, { mode: "jobs", near: true }) },
  ];
  const proof = [
    stats && stats.vacancies > 0 ? { key: "jobs", icon: BriefcaseBusiness, text: t("welcome.market.cta_seek_hint", { count: num(stats.vacancies) }) } : null,
    stats && stats.workers > 0 ? { key: "workers", icon: UsersRound, text: t("welcome.market.cta_hire_hint", { count: num(stats.workers) }) } : null,
  ].filter((p) => p !== null);
  return (
    <section aria-labelledby="hero-title">
      <div className="relative overflow-hidden border-b border-border bg-card">
        <div className="container-app grid grid-cols-1 gap-10 pb-20 pt-7 sm:pb-24 sm:pt-12 lg:min-h-[33rem] lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:items-center lg:pb-28 lg:pt-12">
          <div className="relative z-10">
            {stats && stats.today > 0 ? (
              <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-primary sm:mb-5">
                <span className="entry-live" aria-hidden />
                {t("welcome.entry.today", { count: num(stats.today) })}
              </p>
            ) : null}
            <h1 id="hero-title" className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              <HeroTitle text={t("welcome.market.hero_title")} />
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:mt-5 sm:text-lg">{t("welcome.market.hero_subtitle")}</p>
            <div className="mt-6 grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:mt-8 sm:flex sm:flex-wrap">
              <RoleCta mode="worker" primary icon={Search} label={t("welcome.market.cta_seek")} />
              <RoleCta mode="employer" icon={UsersRound} label={t("welcome.market.cta_hire")} />
            </div>
            {/* haqiqiy raqamlar (kompyuterda — o'ngdagi suzuvchi kartada) */}
            {proof.length ? (
              <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-muted-foreground lg:hidden">
                {proof.map((p) => (
                  <li key={p.key} className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-success" aria-hidden />
                    {p.text}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="relative hidden h-[32rem] lg:block">
            {/* ko'k shakl: katta doira, o'ng chetdan chiqib ketadi; ichida — nozik halqa */}
            <span aria-hidden className="absolute left-14 top-1/2 size-[46rem] -translate-y-1/2 rounded-full bg-primary" />
            <span aria-hidden className="absolute left-32 top-1/2 size-[36rem] -translate-y-1/2 rounded-full border border-primary-foreground/20" />
            {photo ? (
              <div className="absolute bottom-6 right-0 top-6 w-[22rem] overflow-hidden rounded-2xl border-4 border-card bg-muted shadow-md">
                <Photo src={photo} alt="" sizes="352px" className="size-full" fallback={null} />
              </div>
            ) : (
              <Suspense fallback={<PeekSkeleton />}>
                <HeroPeek />
              </Suspense>
            )}
            {proof.length ? (
              <ul aria-label={t("welcome.market.peek_label")} className="absolute bottom-0 left-0 z-10 space-y-2 rounded-2xl bg-card p-3 pr-5 shadow-md ring-1 ring-black/5">
                {proof.map((p) => (
                  <li key={p.key} className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary" aria-hidden>
                      <p.icon className="size-5" />
                    </span>
                    {p.text}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
      <div className="container-app relative z-10 -mt-12 pb-6 sm:-mt-14 sm:pb-8">
        <HeroSearch />
        <nav aria-label={t("welcome.market.quick_label")} className="-mx-4 mt-3 sm:mx-0">
          <ul className="flex items-center gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
            <li className="hidden shrink-0 pr-1 text-sm font-semibold text-muted-foreground sm:block" aria-hidden>
              {t("welcome.market.popular")}
            </li>
            {/* AI yordamchi — qatorning boshida (telefonda ham birinchi ekranda ko'rinsin); mehmon oynada ish yoki xodimni tanlaydi */}
            {ai ? (
              <li className="flex">
                <AiFinder defaultMode="jobs" className="border border-primary/30 bg-card" />
              </li>
            ) : null}
            {chips.map((c) => (
              <li key={c.key} className="flex">
                {/* tezkor filtr: ish qidiruvchi rejimi yoziladi va natijalar ochiladi */}
                <form action={enterMode} className="flex">
                  <input type="hidden" name="mode" value="worker" />
                  <input type="hidden" name="next" value={c.next} />
                  <TileButton
                    data-track="entry_quick"
                    data-track-to={c.key}
                    className="press inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-3.5 text-sm font-semibold text-foreground hover:border-primary/50 hover:text-primary"
                  >
                    <c.icon className="size-4 shrink-0 text-primary" aria-hidden />
                    {c.label}
                  </TileButton>
                </form>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  );
}

/**
 * Sarlavha matni: "|" — yangi qator (planshet va kompyuterda har jumla alohida qatorda), [ ] — ko'k urg'u. Tarjimada so'z tartibi
 * har xil bo'lgani uchun belgilar tarjima ichida. Qatorlar — bitta h1 matni va <br> (alohida bloklar emas): telefonda tabiiy
 * o'raladi, ekran o'qigichi bitta jumla sifatida o'qiydi.
 */
function HeroTitle({ text }: { text: string }) {
  return text.split("|").map((line, i) => (
    <Fragment key={i}>
      {i > 0 ? (
        <>
          {" "}
          <br className="hidden sm:inline" />
        </>
      ) : null}
      {line.split(/(\[[^\]]+\])/).map((part, j) =>
        part.startsWith("[") && part.endsWith("]") ? (
          <span key={j} className="text-primary">
            {part.slice(1, -1)}
          </span>
        ) : (
          part
        ),
      )}
    </Fragment>
  ));
}

function RoleCta({ mode, primary, icon: Icon, label }: { mode: AppMode; primary?: boolean; icon: LucideIcon; label: string }) {
  return (
    <form action={enterMode} className="flex">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="next" value="/" />
      <TileButton
        data-track="entry_role"
        data-track-to={mode}
        className={cn(
          "press inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-6 text-base font-bold transition-colors sm:w-auto",
          primary ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover" : "border border-primary/40 bg-card text-primary hover:bg-primary-soft",
        )}
      >
        <Icon className="size-5 shrink-0" aria-hidden />
        {label}
        {primary ? <ArrowRight className="size-5 shrink-0" aria-hidden /> : null}
      </TileButton>
    </form>
  );
}

/** Surat yo'q bo'lsa — o'ng tomonda haqiqiy yangi vakansiyalar (bosiladi). Xato yoki bo'sh — brend tasviri */
async function HeroPeek() {
  const { t } = await getT();
  const { params, remote } = latestTabFind("all");
  const res = await findJobs(params, { regionId: null, districtId: null, remote }, 3);
  const items = res.ok ? res.items : [];
  if (!items.length) {
    return (
      <div className="absolute right-6 top-1/2 flex size-80 -translate-y-1/2 items-center justify-center rounded-full bg-card shadow-md" aria-hidden>
        <Image src="/brand/logo-figures.webp" alt="" width={240} height={240} className="size-60 object-contain" />
      </div>
    );
  }
  return (
    <div className="absolute right-0 top-0 w-[27rem] rounded-2xl bg-card p-4 shadow-md ring-1 ring-black/5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-sm font-bold text-foreground">
          <span className="entry-live" aria-hidden />
          {t("welcome.market.peek_title")}
        </p>
        <Link href="/jobs?sort=newest" prefetch={false} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          {t("welcome.market.peek_all")}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <ul className="space-y-2">
        {items.map((job) => (
          <li key={job.id}>
            <JobPeekRow job={job} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function PeekSkeleton() {
  return (
    <div className="absolute right-0 top-0 w-[27rem] space-y-2 rounded-2xl bg-card p-4 shadow-md" aria-hidden>
      <Skeleton className="h-5 w-40" />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  );
}

/**
 * Qidiruv paneli: kasb (matn) va hudud — ikki maydon, bitta tugma (Jobio: kulrang maydonlar, belgilar bilan). Yorliqlar ekran
 * o'qigichi uchun saqlanadi. Server action — JS'siz ham ishlaydi, qiymatlar serverda tekshiriladi va /search ga yo'naltiriladi.
 */
async function HeroSearch() {
  const [{ t, name }, regions] = await Promise.all([getT(), getRegions()]);
  const field = "border-transparent bg-muted hover:border-border focus-visible:bg-card";
  return (
    <form action={homeSearch} role="search" aria-label={t("welcome.market.search_label")} className="rounded-2xl bg-card p-2.5 text-foreground shadow-lg ring-1 ring-black/5 sm:p-3">
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] lg:items-center">
        <div>
          <label htmlFor="hero-q" className="sr-only">
            {t("welcome.market.q_label")}
          </label>
          <Input id="hero-q" name="q" type="search" enterKeyHint="search" maxLength={120} autoComplete="off" leftIcon={<Search />} placeholder={t("welcome.market.q_placeholder")} className={field} />
        </div>
        <div className="relative">
          <label htmlFor="hero-region" className="sr-only">
            {t("welcome.market.region_label")}
          </label>
          <MapPin className="pointer-events-none absolute left-4 top-1/2 z-10 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Select
            id="hero-region"
            name="region"
            placeholder={t("welcome.market.region_placeholder")}
            aria-describedby="hero-region-hint"
            className={cn(field, "pl-11")}
            options={[
              { value: "all", label: t("welcome.market.region_all") },
              { value: "remote", label: t("welcome.market.region_remote") },
              ...regions.map((r) => ({ value: r.slug, label: name(r) })),
            ]}
          />
          <span id="hero-region-hint" className="sr-only">
            {t("welcome.market.region_hint")}
          </span>
        </div>
        <TileButton className="press inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-7 text-base font-bold text-primary-foreground shadow-sm hover:bg-primary-hover lg:w-auto">
          <Search className="size-5" aria-hidden />
          {t("welcome.market.submit")}
        </TileButton>
      </div>
    </form>
  );
}
