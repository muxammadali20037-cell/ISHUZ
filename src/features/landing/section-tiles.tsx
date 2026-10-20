import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  Crown,
  Landmark,
  Laptop,
  LayoutGrid,
  MapPin,
  Sprout,
  Store,
  User,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { Skeleton } from "@/components/ui/skeleton";
import { EMPTY_FIND, findHref, type FindParams } from "@/features/find/params";
import { WindowArtwork } from "@/features/home-windows/window-art";
import type { WindowArt } from "@/features/home-windows/model";
import { EntryImage } from "@/features/entry/components/entry-art";
import type { EntryMedia, EntrySlot } from "@/features/entry/media";
import { getEntryMedia } from "@/features/entry/queries";
import { getHomePlace, type HomePlace } from "./home-queries";
import { getJobSections, getWorkerSections } from "./sections";

const num = (v: number) => new Intl.NumberFormat("ru-RU").format(v);

interface BigTile {
  key: string;
  href: string;
  label: string;
  art: WindowArt;
  /** admin yuklagan rasm joyi (Kirish ekranlari → katta plitkalar); rasm bo'lmasa — `art` */
  slot?: EntrySlot;
  /** son yoki izoh (son noma'lum bo'lsa) */
  sub: string;
}

interface SmallTile {
  key: string;
  href: string;
  label: string;
  /** to'liq nomi (qisqartma uchun, masalan "MChJ", "YaTT") */
  title?: string;
  icon: LucideIcon;
  /** null — son yo'q (bo'lim sonsiz ishlaydi: "Barcha sohalar") */
  count: number | null;
  /** asosiy bo'lim (masofaviy, tajribasiz, tajribali): soni 0 bo'lsa ham ko'rsatiladi */
  core?: boolean;
}

/**
 * Yandex Go uslubidagi bo'limlar: tepada ikkita katta plitka (rasm bilan), ostida kichik belgilar qatori.
 * Har bo'lim — haqiqiy son (0066) va shu bo'lim bo'yicha natijalar; asosiy bo'limlardan tashqari soni 0 bo'lgan kichik bo'lim
 * ko'rsatilmaydi (bo'sh oynaga olib bormaymiz). Sonlar olinmasa — faqat sonsiz ishlaydigan bo'limlar.
 */
function SectionGrid({ title, big, small, media }: { title: string; big: BigTile[]; small: SmallTile[]; media: EntryMedia }) {
  return (
    <section aria-labelledby="home-sections">
      <h2 id="home-sections" className="sr-only">
        {title}
      </h2>
      <ul className="grid grid-cols-2 gap-3">
        {big.map((b) => (
          <li key={b.key} className="flex">
            <Link
              href={b.href}
              prefetch={false}
              data-track="home_section"
              data-track-to={b.key}
              className="press lift flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm hover:border-primary/50"
            >
              <span className="block aspect-[16/9] w-full" aria-hidden>
                {b.slot ? <EntryImage slot={b.slot} media={media} sizes="(min-width: 768px) 360px, 50vw" className="size-full" /> : <WindowArtwork art={b.art} cover />}
              </span>
              <span className="flex flex-1 flex-col px-3 pb-3 pt-2">
                <span className="text-base font-extrabold leading-tight">{b.label}</span>
                <span className="mt-0.5 text-sm leading-snug text-muted-foreground">{b.sub}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {small.length ? (
        <ul className="mt-3 grid grid-cols-4 gap-1.5 min-[400px]:gap-2 sm:grid-cols-5 lg:grid-cols-5">
          {small.map((s) => (
            <li key={s.key} className="flex">
              <Link
                href={s.href}
                prefetch={false}
                title={s.title}
                data-track="home_section"
                data-track-to={s.key}
                className="press flex w-full flex-col items-center gap-1 rounded-2xl border border-border bg-card px-1 pb-2 pt-2.5 text-center hover:border-primary/50"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary" aria-hidden>
                  <s.icon className="size-5" />
                </span>
                <span className="text-xs font-semibold leading-tight max-[379px]:text-2xs max-[379px]:tracking-tight">{s.label}</span>
                {s.count !== null ? <span className="text-2xs font-semibold tabular text-muted-foreground">{num(s.count)}</span> : null}
                {s.title ? <span className="sr-only">{s.title}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Joy (hudud) bo'yicha URL qismi: eslab qolingan hudud, bo'lmasa butun O'zbekiston */
function wherePatch(place: HomePlace): Partial<FindParams> {
  return { region: place.region?.slug ?? "all", district: place.region ? (place.district?.id ?? "all") : null };
}

/** Ish qidiruvchi bo'limlari: Kunlik ishlar · Yaqin atrofda | Masofaviy · Tajribasiz · MChJ · YaTT · Davlat · Jismoniy shaxs · Ommaviy · TOP · Barcha sohalar */
async function seekerSectionItems(place: HomePlace) {
  const [{ t }, c] = await Promise.all([getT(), getJobSections(place.region?.id ?? null, place.district?.id ?? null)]);
  const any: FindParams = { ...EMPTY_FIND, mode: "jobs", any: true, ...wherePatch(place) };
  const big: BigTile[] = [
    {
      key: "daily",
      href: findHref({ ...EMPTY_FIND, mode: "jobs", pay: "daily", ...wherePatch(place) }),
      label: t("easy.sections.daily"),
      art: "daily",
      slot: "tile_daily_jobs",
      sub: c ? t("easy.sections.jobs_count", { count: num(c.daily) }) : t("easy.sections.daily_hint"),
    },
    {
      key: "near",
      href: findHref({ ...EMPTY_FIND, mode: "jobs", near: true }),
      label: t("easy.sections.near"),
      art: "near",
      slot: "tile_near_jobs",
      sub: t("easy.sections.near_hint"),
    },
  ];
  const small: SmallTile[] = [
    { key: "remote", href: findHref(any, { region: "remote", district: null }), label: t("easy.sections.remote"), icon: Laptop, count: c?.remote ?? null, core: true },
    { key: "noexp", href: findHref(any, { noexp: true }), label: t("easy.sections.noexp"), icon: Sprout, count: c?.noexp ?? null, core: true },
    ...(c
      ? ([
          { key: "company", href: findHref(any, { etype: "company" }), label: t("easy.sections.company"), title: t("easy.sections.company_title"), icon: Building2, count: c.company },
          { key: "ie", href: findHref(any, { etype: "ie" }), label: t("easy.sections.ie"), title: t("easy.sections.ie_title"), icon: Store, count: c.ie },
          { key: "gov", href: findHref(any, { etype: "gov" }), label: t("easy.sections.gov"), title: t("easy.sections.gov_title"), icon: Landmark, count: c.gov },
          { key: "person", href: findHref(any, { etype: "person" }), label: t("easy.sections.person"), title: t("easy.sections.person_title"), icon: User, count: c.person },
          { key: "mass", href: findHref(any, { mass: true }), label: t("easy.sections.mass"), title: t("easy.sections.mass_title"), icon: UsersRound, count: c.mass },
          { key: "top", href: findHref(any, { top: true }), label: t("easy.sections.top"), title: t("easy.sections.top_title"), icon: Crown, count: c.top },
        ] satisfies SmallTile[])
      : []),
  ].filter((s) => s.core || s.count === null || s.count > 0);
  small.push({ key: "all", href: findHref(EMPTY_FIND, { mode: "jobs" }), label: t("easy.sections.all"), icon: LayoutGrid, count: null });
  return { title: t("easy.sections.title"), big, small, dailyCount: c?.daily ?? null };
}

/**
 * Ixcham bo'limlar ro'yxati (2026-10 redizayn, bosh sahifaning yon paneli): katta rasmli plitkalar o'rnida — belgi, nomi va
 * haqiqiy son bir qatorda. Telefonda ro'yxatdan keyin ikki ustun, kompyuterda o'ng panelda bitta ustun.
 */
export async function SeekerSectionList({ place }: { place: HomePlace }) {
  const { title, big, small, dailyCount } = await seekerSectionItems(place);
  const rows: { key: string; href: string; label: string; title?: string; icon: LucideIcon; count: number | null }[] = [
    { key: big[0]!.key, href: big[0]!.href, label: big[0]!.label, icon: CalendarDays, count: dailyCount },
    { key: big[1]!.key, href: big[1]!.href, label: big[1]!.label, icon: MapPin, count: null },
    ...small,
  ];
  return (
    <section aria-labelledby="home-sections" className="rounded-xl border border-border bg-card p-2">
      <h2 id="home-sections" className="px-2 pb-1 pt-1.5 text-base font-bold">
        {title}
      </h2>
      <ul className="grid grid-cols-2 gap-x-1 lg:grid-cols-1">
        {rows.map((r) => (
          <li key={r.key} className="flex min-w-0">
            <Link
              href={r.href}
              prefetch={false}
              title={r.title}
              data-track="home_section"
              data-track-to={r.key}
              className="press flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg px-2 text-sm font-semibold hover:bg-secondary hover:text-primary"
            >
              <r.icon className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{r.label}</span>
              {r.title ? <span className="sr-only">{r.title}</span> : null}
              {r.count !== null ? <span className="shrink-0 text-sm font-medium tabular text-muted-foreground">{num(r.count)}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Ish beruvchi: Kunlik ishchilar · Yaqin ishchilar | Tajribali · Masofaviy · Barcha ishchilar · Barcha sohalar (vakansiya joylash — sahifaning asosiy tugmasi) */
export async function HireSections({ place: given }: { place?: HomePlace }) {
  const place = given ?? (await getHomePlace());
  const [{ t }, c, media] = await Promise.all([getT(), getWorkerSections(place.region?.id ?? null, place.district?.id ?? null), getEntryMedia()]);
  const any: FindParams = { ...EMPTY_FIND, mode: "workers", any: true, ...wherePatch(place) };
  // sonlar olinmasa birinchi plitka "Barcha ishchilar" bo'ladi — unga kunlik ishchilar rasmi qo'yilmaydi (o'rnatilgan tasvir)
  const big: BigTile[] = [
    c
      ? {
          key: "daily_workers",
          href: findHref(any, { pay: "daily" }),
          label: t("easy.sections.daily_workers"),
          art: "daily",
          slot: "tile_daily_workers",
          sub: t("easy.sections.workers_count", { count: num(c.daily) }),
        }
      : { key: "all_workers", href: findHref(any), label: t("easy.sections.all_workers"), art: "workers", sub: t("easy.sections.daily_workers_hint") },
    {
      key: "near_workers",
      href: findHref({ ...EMPTY_FIND, mode: "workers", near: true }),
      label: t("easy.sections.near_workers"),
      art: "near",
      slot: "tile_near_workers",
      sub: t("easy.sections.near_hint"),
    },
  ];
  const small: SmallTile[] = [
    { key: "experienced", href: findHref(any, { exp: true }), label: t("easy.sections.experienced"), icon: BadgeCheck, count: c?.experienced ?? null, core: true },
    { key: "remote_workers", href: findHref(any, { region: "remote", district: null }), label: t("easy.sections.remote"), icon: Laptop, count: c?.remote ?? null, core: true },
    ...(c ? [{ key: "all_workers", href: findHref(any), label: t("easy.sections.all_workers"), icon: UsersRound, count: c.total }] : []),
  ].filter((s) => s.core || s.count === null || s.count > 0);
  small.push({ key: "all", href: findHref(EMPTY_FIND, { mode: "workers" }), label: t("easy.sections.all"), icon: LayoutGrid, count: null });
  return <SectionGrid title={t("easy.sections.title")} big={big} small={small} media={media} />;
}

/** Bo'limlar oqim bilan keladi — o'rnini oldindan egallaydi (sahifa sakramaydi) */
export function SectionsSkeleton() {
  return (
    <div aria-hidden>
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
            <Skeleton className="aspect-[16/9] w-full rounded-none" />
            <div className="space-y-1.5 px-3 pb-3 pt-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3.5 w-1/2" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5 min-[400px]:gap-2 sm:grid-cols-5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
