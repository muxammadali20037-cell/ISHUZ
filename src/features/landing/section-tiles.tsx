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
import { EMPTY_FIND, findHref, type FindParams } from "@/features/find/params";
import type { HomePlace } from "./home-queries";
import { getJobSections, getWorkerSections } from "./sections";

const num = (v: number) => new Intl.NumberFormat("ru-RU").format(v);

interface SectionRow {
  key: string;
  href: string;
  label: string;
  /** to'liq nomi (qisqartma uchun, masalan "MChJ", "YaTT") */
  title?: string;
  icon: LucideIcon;
  /** null — son yo'q (bo'lim sonsiz ishlaydi: "Barcha sohalar", "Yaqin atrofda") */
  count: number | null;
  /** asosiy bo'lim (masofaviy, tajribasiz, tajribali): soni 0 bo'lsa ham ko'rsatiladi */
  core?: boolean;
}

/**
 * Bo'limlar (2026-10 redizayn): katta rasmli plitkalar o'rnida ixcham ro'yxat — belgi, nomi va haqiqiy son bir qatorda.
 * Telefonda ro'yxatdan keyin ikki ustun, kompyuterda o'ng panelda bitta ustun. Asosiy bo'limlardan tashqari soni 0 bo'lgan
 * bo'lim ko'rsatilmaydi (bo'sh oynaga olib bormaymiz); sonlar olinmasa — faqat sonsiz ishlaydigan bo'limlar.
 */
function SectionList({ title, rows }: { title: string; rows: SectionRow[] }) {
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

/** Joy (hudud) bo'yicha URL qismi: eslab qolingan hudud, bo'lmasa butun O'zbekiston */
function wherePatch(place: HomePlace): Partial<FindParams> {
  return { region: place.region?.slug ?? "all", district: place.region ? (place.district?.id ?? "all") : null };
}

/** Ish qidiruvchi: Kunlik ishlar · Yaqin atrofda · Masofaviy · Tajribasiz · MChJ · YaTT · Davlat · Jismoniy shaxs · Ommaviy · TOP · Barcha sohalar */
export async function SeekerSectionList({ place }: { place: HomePlace }) {
  const [{ t }, c] = await Promise.all([getT(), getJobSections(place.region?.id ?? null, place.district?.id ?? null)]);
  const any: FindParams = { ...EMPTY_FIND, mode: "jobs", any: true, ...wherePatch(place) };
  const rows: SectionRow[] = [
    { key: "daily", href: findHref({ ...EMPTY_FIND, mode: "jobs", pay: "daily", ...wherePatch(place) }), label: t("easy.sections.daily"), icon: CalendarDays, count: c?.daily ?? null, core: true },
    { key: "near", href: findHref({ ...EMPTY_FIND, mode: "jobs", near: true }), label: t("easy.sections.near"), icon: MapPin, count: null },
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
        ] satisfies SectionRow[])
      : []),
  ].filter((r) => r.core || r.count === null || r.count > 0);
  rows.push({ key: "all", href: findHref(EMPTY_FIND, { mode: "jobs" }), label: t("easy.sections.all"), icon: LayoutGrid, count: null });
  return <SectionList title={t("easy.sections.title")} rows={rows} />;
}

/** Ish beruvchi: Kunlik ishchilar · Yaqin ishchilar · Tajribali · Masofaviy · Barcha ishchilar · Barcha sohalar */
export async function HireSectionList({ place }: { place: HomePlace }) {
  const [{ t }, c] = await Promise.all([getT(), getWorkerSections(place.region?.id ?? null, place.district?.id ?? null)]);
  const any: FindParams = { ...EMPTY_FIND, mode: "workers", any: true, ...wherePatch(place) };
  const rows: SectionRow[] = [
    ...(c ? [{ key: "daily_workers", href: findHref(any, { pay: "daily" }), label: t("easy.sections.daily_workers"), icon: CalendarDays, count: c.daily }] : []),
    { key: "near_workers", href: findHref({ ...EMPTY_FIND, mode: "workers", near: true }), label: t("easy.sections.near_workers"), icon: MapPin, count: null },
    { key: "experienced", href: findHref(any, { exp: true }), label: t("easy.sections.experienced"), icon: BadgeCheck, count: c?.experienced ?? null, core: true },
    { key: "remote_workers", href: findHref(any, { region: "remote", district: null }), label: t("easy.sections.remote"), icon: Laptop, count: c?.remote ?? null, core: true },
    { key: "all_workers", href: findHref(any), label: t("easy.sections.all_workers"), icon: UsersRound, count: c?.total ?? null, core: true },
  ];
  rows.push({ key: "all", href: findHref(EMPTY_FIND, { mode: "workers" }), label: t("easy.sections.all"), icon: LayoutGrid, count: null });
  return <SectionList title={t("easy.sections.title")} rows={rows} />;
}
