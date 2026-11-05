import { Fragment } from "react";
import Image from "next/image";
import { ArrowRight, BriefcaseBusiness, CalendarDays, Laptop, MapPin, Search, Sparkles, Sprout, UsersRound, type LucideIcon } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { AiFinder } from "@/features/find/components/ai-finder";
import { getRegions } from "@/lib/reference";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EMPTY_FIND, findHref } from "@/features/find/params";
import { enterMode } from "@/features/mode/actions";
import type { AppMode } from "@/features/mode/mode";
import { entryMediaUrl, type EntryMedia } from "@/features/entry/media";
import { HERO_PHOTO } from "@/features/catalog/photos";
import { cn } from "@/lib/utils";
import { TileButton } from "../entry-client";
import { seekerQuickFilters } from "../quick-filters";
import type { EntryStats } from "../entry-queries";
import { WORK_TYPES, type MarketCounts } from "./model";
import { homeSearch } from "./actions";

const num = (n: number) => new Intl.NumberFormat("ru-RU").format(n);

/**
 * Bosh sahifaning birinchi ekrani (2026-11-05, egasi: haqiqiy suratlar, och ko'k/oq fon): chapda sarlavha ("Ish toping. Yoki
 * jamoangizga odam toping."), ikki yo'l ("Men ish qidiryapman" — asosiy, "Menga ishchi kerak"), uch maydonli qidiruv (kasb ·
 * hudud · ish turi) va tezkor filtrlar; o'ngda (kompyuterda) katta haqiqiy surat — admin yuklagani (home_photo) yoki egasi
 * bergan o'rnatilgan surat. Surat ustidagi kartalarda — faqat bazadagi raqamlar (0 yoki xato — karta yo'q).
 */
export async function MarketHero({ stats, counts, media, ai = false }: { stats: EntryStats | null; counts: MarketCounts | null; media: EntryMedia; ai?: boolean }) {
  const { t } = await getT();
  const uploaded = entryMediaUrl(media.home_photo);
  const seek = Object.fromEntries(seekerQuickFilters({ region: null, district: null }).map((f) => [f.key, f.href])) as Record<"salary" | "noexp" | "daily" | "remote", string>;
  const chips: { key: string; icon: LucideIcon; label: string; next: string }[] = [
    { key: "daily", icon: CalendarDays, label: t("welcome.market.q_daily"), next: seek.daily },
    { key: "noexp", icon: Sprout, label: t("welcome.market.q_noexp"), next: seek.noexp },
    { key: "remote", icon: Laptop, label: t("welcome.market.q_remote"), next: seek.remote },
    { key: "new", icon: Sparkles, label: t("welcome.market.q_new"), next: "/jobs?sort=newest" },
    { key: "near", icon: MapPin, label: t("welcome.market.q_near"), next: findHref(EMPTY_FIND, { mode: "jobs", near: true }) },
  ];
  const vacancies = stats && stats.vacancies > 0 ? stats.vacancies : 0;
  const today = stats && stats.today > 0 ? stats.today : 0;
  const employers = counts && counts.employers > 0 ? counts.employers : 0;
  return (
    <section aria-labelledby="hero-title" className="border-b border-border bg-hero-soft">
      <div className="container-app grid grid-cols-1 gap-10 pb-10 pt-8 sm:pb-14 sm:pt-12 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] lg:items-center lg:gap-12 lg:pb-16 lg:pt-14">
        <div className="min-w-0">
          {vacancies ? (
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground">
              <span className="entry-live" aria-hidden />
              {t("welcome.hero.live", { count: num(vacancies) })}
            </p>
          ) : null}
          <h1 id="hero-title" className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
            <HeroTitle text={t("welcome.hero.title")} />
          </h1>
          <p className="mt-4 max-w-[54ch] text-lg leading-relaxed text-muted-foreground">{t("welcome.hero.subtitle")}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <RoleCta mode="worker" primary icon={Search} label={t("welcome.hero.cta_seek")} />
            <RoleCta mode="employer" icon={UsersRound} label={t("welcome.hero.cta_hire")} />
          </div>
          <div className="mt-6">
            <HeroSearch />
          </div>
          <nav aria-label={t("welcome.market.quick_label")} className="-mx-4 mt-4 sm:mx-0">
            <ul className="flex items-center gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
              <li className="hidden shrink-0 pr-1 text-sm font-medium text-muted-foreground sm:block" aria-hidden>
                {t("welcome.hero.popular")}
              </li>
              {/* AI yordamchi — qatorning boshida (telefonda ham birinchi ekranda ko'rinsin) */}
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

        {/* katta surat (kompyuterda): telefonda birinchi ekranda qidiruv va sohalar suratlari muhimroq */}
        <div className="relative hidden lg:block">
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted">
            {uploaded ? (
              <Image src={uploaded} alt={t("welcome.hero.photo_alt_generic")} fill unoptimized priority sizes="(min-width: 1280px) 480px, (min-width: 1024px) 40vw, 1px" className="object-cover" />
            ) : (
              <Image src={HERO_PHOTO} alt={t("welcome.hero.photo_alt")} fill priority placeholder="blur" sizes="(min-width: 1280px) 480px, (min-width: 1024px) 40vw, 1px" className="object-cover" />
            )}
          </div>
          {today ? (
            <div className="absolute -left-6 bottom-10 flex items-center gap-3 rounded-xl border border-border bg-card p-3 pr-4 shadow-lg">
              <span className="flex size-10 items-center justify-center rounded-lg bg-success-soft text-success" aria-hidden>
                <Sparkles className="size-5" />
              </span>
              <span>
                <span className="block text-lg font-semibold leading-tight">+{num(today)}</span>
                <span className="block text-sm text-muted-foreground">{t("welcome.hero.today")}</span>
              </span>
            </div>
          ) : null}
          {employers ? (
            <div className="absolute -right-4 top-8 flex items-center gap-3 rounded-xl border border-border bg-card p-3 pr-4 shadow-lg">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary" aria-hidden>
                <BriefcaseBusiness className="size-5" />
              </span>
              <span>
                <span className="block text-lg font-semibold leading-tight">{num(employers)}</span>
                <span className="block text-sm text-muted-foreground">{t("welcome.hero.employers")}</span>
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/**
 * Sarlavha matni: "|" — yangi qator (planshet va kompyuterda), [ ] — ko'k urg'u. Belgilar tarjima ichida (so'z tartibi har
 * tilda boshqacha). Qatorlar — bitta h1 matni va <br>: telefonda tabiiy o'raladi, ekran o'qigichi bitta jumla sifatida o'qiydi.
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
          "press inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md px-6 text-md font-semibold transition-colors sm:w-auto",
          primary ? "bg-primary text-primary-foreground hover:bg-primary-hover" : "border border-border-strong bg-card text-foreground hover:border-primary/50 hover:text-primary",
        )}
      >
        <Icon className="size-5 shrink-0" aria-hidden />
        {label}
        {primary ? <ArrowRight className="size-5 shrink-0" aria-hidden /> : null}
      </TileButton>
    </form>
  );
}

/**
 * Qidiruv paneli: kasb yoki lavozim · hudud · ish turi · "Qidirish". Yorliqlar ko'rinadi (kichik), maydonlar 44 px. Server
 * action — JS'siz ham ishlaydi: qiymatlar serverda tekshiriladi va mavjud /search oqimiga yo'naltiriladi (model.heroSearchHref).
 */
async function HeroSearch() {
  const [{ t, name }, regions] = await Promise.all([getT(), getRegions()]);
  const label = "mb-1 block px-1 text-sm font-medium text-foreground";
  return (
    <form action={homeSearch} role="search" aria-label={t("welcome.market.search_label")} className="rounded-2xl border border-border bg-card p-3 shadow-md sm:p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        <div className="sm:col-span-2 lg:col-span-3">
          <label htmlFor="hero-q" className={label}>
            {t("welcome.hero.q_label")}
          </label>
          <Input id="hero-q" name="q" type="search" enterKeyHint="search" maxLength={120} autoComplete="off" leftIcon={<Search />} placeholder={t("welcome.market.q_placeholder")} />
        </div>
        <div>
          <label htmlFor="hero-region" className={label}>
            {t("welcome.hero.region_label")}
          </label>
          <Select
            id="hero-region"
            name="region"
            placeholder={t("welcome.hero.region_placeholder")}
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
        <div>
          <label htmlFor="hero-type" className={label}>
            {t("welcome.market.type_label")}
          </label>
          <Select id="hero-type" name="type" placeholder={t("welcome.market.type_any")} options={WORK_TYPES.map((w) => ({ value: w, label: t(`welcome.market.type_${w}`) }))} />
        </div>
        <TileButton className="press inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-6 text-md font-semibold text-primary-foreground hover:bg-primary-hover sm:col-span-2 lg:col-span-1 lg:w-auto">
          <Search className="size-5" aria-hidden />
          {t("welcome.hero.submit")}
        </TileButton>
      </div>
    </form>
  );
}
