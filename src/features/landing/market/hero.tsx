import { ArrowRight, BriefcaseBusiness, CalendarDays, Laptop, MapPin, Search, Sparkles, Sprout, UsersRound, type LucideIcon } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { AiFinder } from "@/features/find/components/ai-finder";
import { getRegions } from "@/lib/reference";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EMPTY_FIND, findHref } from "@/features/find/params";
import { enterMode } from "@/features/mode/actions";
import type { AppMode } from "@/features/mode/mode";
import type { EntryMedia } from "@/features/entry/media";
import { EntryImage } from "@/features/entry/components/entry-art";
import { cn } from "@/lib/utils";
import { TileButton } from "../entry-client";
import { seekerQuickFilters } from "../quick-filters";
import type { EntryStats } from "../entry-queries";
import { homeSearch } from "./actions";
import { HERO_SALARIES, WORK_TYPES } from "./model";

const num = (n: number) => new Intl.NumberFormat("ru-RU").format(n);

/**
 * Bosh sahifaning birinchi ekrani: 3 soniyada nima ekani tushunarli — sarlavha, ikki aniq yo'l ("Ish qidiraman" /
 * "Xodim qidiraman" — rejim yoziladi, mavjud bosh sahifasiga), katta qidiruv paneli va tezkor filtrlar.
 * Kompyuterda o'ngda — admin almashtira oladigan rasmlar (telefonda yo'q: qidiruv yuqoriroq turadi).
 */
export async function MarketHero({ stats, media, ai = false }: { stats: EntryStats | null; media: EntryMedia; ai?: boolean }) {
  const { t } = await getT();
  const seek = Object.fromEntries(seekerQuickFilters({ region: null, district: null }).map((f) => [f.key, f.href])) as Record<"salary" | "noexp" | "daily" | "remote", string>;
  const chips: { key: string; icon: LucideIcon; label: string; next: string }[] = [
    { key: "daily", icon: CalendarDays, label: t("welcome.market.q_daily"), next: seek.daily },
    { key: "noexp", icon: Sprout, label: t("welcome.market.q_noexp"), next: seek.noexp },
    { key: "remote", icon: Laptop, label: t("welcome.market.q_remote"), next: seek.remote },
    { key: "new", icon: Sparkles, label: t("welcome.market.q_new"), next: "/jobs?sort=newest" },
    { key: "near", icon: MapPin, label: t("welcome.market.q_near"), next: findHref(EMPTY_FIND, { mode: "jobs", near: true }) },
  ];
  return (
    <section aria-labelledby="hero-title" className="border-b border-primary/10 bg-primary-soft">
      <div className="container-app grid grid-cols-1 gap-8 pb-6 pt-7 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center lg:gap-12 lg:pb-8 lg:pt-14">
        <div>
          {stats && stats.today > 0 ? (
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-sm font-semibold shadow-sm">
              <span className="entry-live" aria-hidden />
              {t("welcome.entry.today", { count: num(stats.today) })}
            </p>
          ) : null}
          <h1 id="hero-title" className="text-balance text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl lg:leading-tight">
            {t("welcome.market.title_a")}
            <span className="text-primary">{t("welcome.market.title_em")}</span>
            {t("welcome.market.title_b")}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground sm:mt-4 sm:text-lg">{t("welcome.market.subtitle")}</p>
          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:mt-6 sm:max-w-xl sm:gap-3">
            <RoleCta
              mode="worker"
              primary
              icon={BriefcaseBusiness}
              label={t("welcome.market.cta_seek")}
              hint={stats && stats.vacancies > 0 ? t("welcome.market.cta_seek_hint", { count: num(stats.vacancies) }) : t("welcome.market.cta_seek_plain")}
            />
            <RoleCta
              mode="employer"
              icon={UsersRound}
              label={t("welcome.market.cta_hire")}
              hint={stats && stats.workers > 0 ? t("welcome.market.cta_hire_hint", { count: num(stats.workers) }) : t("welcome.market.cta_hire_plain")}
            />
          </div>
        </div>
        <HeroPhotos media={media} seekLabel={t("welcome.market.hero_photo_seek")} hireLabel={t("welcome.market.hero_photo_hire")} />
      </div>
      <div className="container-app pb-7 sm:pb-10">
        <HeroSearch />
        <nav aria-label={t("welcome.market.quick_label")} className="-mx-4 mt-3 sm:mx-0">
          <ul className="flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
            {/* AI yordamchi — qatorning boshida (telefonda ham birinchi ekranda ko'rinsin); mehmon oynada ish yoki xodimni tanlaydi */}
            {ai ? (
              <li className="flex">
                <AiFinder defaultMode="jobs" className="border border-primary/30 bg-card" />
              </li>
            ) : null}
            {chips.map((c) => (
              <li key={c.key} className="flex">
                {/* tezkor filtr: ish qidiruvchi rejimi yoziladi va natijalar ochiladi (avvalgi "tez kirish" plitkalari kabi) */}
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

function RoleCta({ mode, primary, icon: Icon, label, hint }: { mode: AppMode; primary?: boolean; icon: LucideIcon; label: string; hint: string }) {
  return (
    <form action={enterMode} className="flex">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="next" value="/" />
      <TileButton
        data-track="entry_role"
        data-track-to={mode}
        className={cn(
          "press lift-sm flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left sm:px-4",
          primary ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover" : "border border-border bg-card text-foreground shadow-sm hover:border-primary/50",
        )}
      >
        <span className={cn("hidden size-10 shrink-0 items-center justify-center rounded-xl min-[400px]:flex", primary ? "bg-primary-foreground/15" : "bg-primary-soft text-primary")} aria-hidden>
          <Icon className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-extrabold leading-tight">{label}</span>
          <span className={cn("mt-0.5 block text-xs leading-snug sm:text-sm", primary ? "opacity-90" : "text-muted-foreground")}>{hint}</span>
        </span>
        <ArrowRight className="hidden size-5 shrink-0 sm:block" aria-hidden />
      </TileButton>
    </form>
  );
}

/** Kompyuterda: ish izlovchi va ish beruvchi rasmlari (admin → Kirish ekranlari; yuklanmagan bo'lsa — o'rnatilgan tasvir) */
function HeroPhotos({ media, seekLabel, hireLabel }: { media: EntryMedia; seekLabel: string; hireLabel: string }) {
  const card = "relative overflow-hidden rounded-2xl border border-border bg-card shadow-md";
  return (
    <div className="relative hidden h-[22rem] lg:block" aria-hidden>
      <div className={cn(card, "absolute left-0 top-0 h-60 w-64")}>
        <EntryImage slot="intro_jobs" media={media} sizes="256px" className="size-full object-cover" />
        <span className="absolute bottom-2 left-2 rounded-lg bg-card px-2 py-1 text-xs font-bold shadow-sm">{seekLabel}</span>
      </div>
      <div className={cn(card, "absolute bottom-0 right-0 h-60 w-64")}>
        <EntryImage slot="intro_workers" media={media} sizes="256px" className="size-full object-cover" />
        <span className="absolute bottom-2 left-2 rounded-lg bg-card px-2 py-1 text-xs font-bold shadow-sm">{hireLabel}</span>
      </div>
    </div>
  );
}

/**
 * Qidiruv paneli: kasb (matn), hudud (viloyatlar ma'lumotnomadan), ish turi va maosh. Server action — JS'siz ham ishlaydi,
 * qiymatlar serverda tekshiriladi va mavjud /search oqimiga yo'naltiriladi (tuman — keyingi qadamda).
 */
async function HeroSearch() {
  const [{ t, name }, regions] = await Promise.all([getT(), getRegions()]);
  const label = "mb-1 block text-sm font-semibold text-foreground";
  return (
    <form action={homeSearch} role="search" aria-label={t("welcome.market.search_label")} className="rounded-2xl border border-border bg-card p-3 shadow-md sm:p-4">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto] lg:items-end">
        <div>
          <label htmlFor="hero-q" className={label}>
            {t("welcome.market.q_label")}
          </label>
          <Input id="hero-q" name="q" type="search" enterKeyHint="search" maxLength={120} autoComplete="off" leftIcon={<Search />} placeholder={t("welcome.market.q_placeholder")} />
        </div>
        <div>
          <label htmlFor="hero-region" className={label}>
            {t("welcome.market.region_label")}
          </label>
          <Select
            id="hero-region"
            name="region"
            placeholder={t("welcome.market.region_placeholder")}
            aria-describedby="hero-region-hint"
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
        <div className="grid grid-cols-2 gap-3 lg:contents">
          <div className="min-w-0">
            <label htmlFor="hero-type" className={label}>
              {t("welcome.market.type_label")}
            </label>
            <Select id="hero-type" name="type" defaultValue="" options={[{ value: "", label: t("welcome.market.type_any") }, ...WORK_TYPES.map((w) => ({ value: w, label: t(`welcome.market.type_${w}`) }))]} />
          </div>
          <div className="min-w-0">
            <label htmlFor="hero-salary" className={label}>
              {t("welcome.market.salary_label")}
            </label>
            <Select
              id="hero-salary"
              name="salary"
              defaultValue=""
              options={[{ value: "", label: t("welcome.market.salary_any") }, ...HERO_SALARIES.map((s) => ({ value: String(s), label: t("welcome.market.salary_from", { amount: s / 1_000_000 }) }))]}
            />
          </div>
        </div>
        <SubmitSearch label={t("welcome.market.submit")} />
      </div>
    </form>
  );
}

function SubmitSearch({ label }: { label: string }) {
  return (
    <TileButton className="press lift-sm inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-bold text-primary-foreground shadow-sm hover:bg-primary-hover lg:w-auto">
      <Search className="size-5" aria-hidden />
      {label}
    </TileButton>
  );
}
