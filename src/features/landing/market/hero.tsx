import { Fragment, Suspense } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, Laptop, MapPin, Search, Sparkles, Sprout, UsersRound, type LucideIcon } from "lucide-react";
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
 * Bosh sahifaning birinchi ekrani (2026-11, egasi: "SAT MASTER" bilan bir xil): sarlavha bilan bitta to'q ko'k maydon —
 * markazda katta sarlavha (oxirgi qatori och ko'k), bir jumlali izoh, ikki yo'l ("Ish qidiraman" — to'ldirilgan,
 * "Ish beruvchiman" — chiziqli), haqiqiy raqamlar belgilar bilan. Pastda maydondan chiqib turgan ramka ichida "jonli
 * ko'rinish": qidiruv paneli va bazadagi eng yangi 3 vakansiya (bosiladi) — namunadagi mahsulot ko'rinishi o'rnida.
 * Soxta avatar, raqam yoki "AI moslik" yo'q: son 0 yoki xato bo'lsa — ko'rsatilmaydi. Admin surati (home_photo) bo'lsa —
 * ramkada ro'yxat o'rnida surat.
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
    stats && stats.vacancies > 0 ? { key: "jobs", text: t("welcome.market.cta_seek_hint", { count: num(stats.vacancies) }) } : null,
    stats && stats.workers > 0 ? { key: "workers", text: t("welcome.market.cta_hire_hint", { count: num(stats.workers) }) } : null,
    stats && stats.today > 0 ? { key: "today", text: t("welcome.entry.today", { count: num(stats.today) }) } : null,
  ].filter((p) => p !== null);
  return (
    <section aria-labelledby="hero-title">
      <div className="bg-navy text-navy-foreground">
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-10 text-center sm:px-6 sm:pb-14 sm:pt-16 lg:px-8 lg:pt-20">
          <h1 id="hero-title" className="mx-auto max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-navy-foreground sm:text-5xl lg:text-6xl">
            <HeroTitle text={t("welcome.market.hero_title")} />
          </h1>
          <p className="mx-auto mt-5 max-w-[60ch] text-lg leading-relaxed text-navy-muted">{t("welcome.market.hero_subtitle")}</p>
          <div className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
            <RoleCta mode="worker" primary icon={Search} label={t("welcome.market.cta_seek")} />
            <RoleCta mode="employer" icon={UsersRound} label={t("welcome.market.cta_hire")} />
          </div>
          {/* haqiqiy raqamlar (0 bo'lsa — yo'q) */}
          {proof.length ? (
            <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-navy-muted">
              {proof.map((p) => (
                <li key={p.key} className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-sidebar-accent" aria-hidden />
                  {p.text}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {/* maydondan chiqib turgan "jonli ko'rinish": qidiruv + eng yangi vakansiyalar. Ramkaning yuqori qismi orqasida to'q ko'k
          tasma (balandligi o'zgarmas) — ro'yxat bo'lmasa ham ramka ostidagi matn och fonda qoladi */}
      <div className="relative px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-x-0 top-0 h-24 bg-navy sm:h-28" aria-hidden />
        <div className="relative mx-auto max-w-5xl">
          <div className="rounded-2xl border border-navy-line bg-navy-line p-2 sm:p-3 dark:border-border dark:bg-muted">
            <div className="rounded-xl bg-card p-3 text-card-foreground sm:p-5">
              <HeroSearch />
              {photo ? (
                <div className="mt-4 hidden aspect-[21/9] overflow-hidden rounded-lg bg-muted sm:block">
                  <Photo src={photo} alt="" sizes="(min-width: 1024px) 1000px, 100vw" className="size-full" fallback={null} />
                </div>
              ) : (
                <Suspense fallback={<PeekSkeleton />}>
                  <HeroPeek />
                </Suspense>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-6 pt-4 sm:px-6 sm:pb-8 lg:px-8">
        <nav aria-label={t("welcome.market.quick_label")} className="-mx-4 sm:mx-0">
          <ul className="flex items-center gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
            <li className="hidden shrink-0 pr-1 text-sm font-medium text-muted-foreground sm:block" aria-hidden>
              {t("welcome.market.popular")}
            </li>
            {/* AI yordamchi — qatorning boshida (telefonda ham birinchi ekranda ko'rinsin); mehmon oynada ish yoki xodimni tanlaydi */}
            {ai ? (
              <li className="flex">
                <AiFinder defaultMode="jobs" className="border border-border bg-card" />
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
                    className="press inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-3.5 text-sm font-medium text-foreground hover:border-primary/50 hover:text-primary"
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
          <span key={j} className="text-sidebar-accent">
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
          "press inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md px-6 text-md font-medium transition-colors sm:w-auto",
          primary ? "bg-primary text-primary-foreground hover:bg-primary-hover" : "border border-navy-foreground/25 text-navy-foreground hover:bg-navy-foreground/10",
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
  if (!items.length) return null;
  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="entry-live" aria-hidden />
          {t("welcome.market.peek_title")}
        </p>
        <Link href="/jobs?sort=newest" prefetch={false} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline">
          {t("welcome.market.peek_all")}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {items.map((job, i) => (
          // telefonda bitta (qidiruv birinchi ekranda qolsin), planshet va kompyuterda — uchtasi yonma-yon
          <li key={job.id} className={i > 0 ? "hidden md:block" : undefined}>
            <JobPeekRow job={job} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function PeekSkeleton() {
  return (
    <div className="mt-4 grid grid-cols-1 gap-2 border-t border-border pt-4 md:grid-cols-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className={cn("h-20 w-full rounded-lg", i > 0 && "hidden md:block")} />
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
  const field = "bg-background hover:border-border-strong focus-visible:bg-card";
  return (
    <form action={homeSearch} role="search" aria-label={t("welcome.market.search_label")} className="text-foreground">
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
        <TileButton className="press inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-6 text-md font-medium text-primary-foreground hover:bg-primary-hover lg:w-auto">
          <Search className="size-5" aria-hidden />
          {t("welcome.market.submit")}
        </TileButton>
      </div>
    </form>
  );
}
