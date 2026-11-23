"use client";

import { useState, useSyncExternalStore, type ButtonHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { Award, BriefcaseBusiness, CalendarClock, GraduationCap, Hammer, Laptop, MapPin, Plus, Search, Sparkles, UsersRound, type LucideIcon } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EMPTY_FIND, findHref } from "@/features/find/params";
import type { QuickMode, QuickOption } from "@/features/find/quick-types";
import { employerQuickFilters, seekerQuickFilters } from "@/features/landing/quick-filters";
import type { GuidedChat } from "../guided";
import { ChatIntro } from "./chat-intro";

const noopSubscribe = () => () => {};

/**
 * Bosh ekran — chat bo'sh holati (ega, 2026-11-23: variantlardan "C — qidiruv qatori" tanlandi, rang — sariq "E'lon
 * berish"). Tepadan: sarlavha → qidiruv qatori (kasb + hudud + "Qidirish") → uchta katta tugma (Ish qidiryapman /
 * Ishchi qidiryapman / E'lon berish — sariq) → tezkor bo'limlar → eng yangi haqiqiy e'lonlar → "Qanday ishlaydi?".
 * Qidiruv ham, tugmalar ham — shu chatning o'zi: natijalar, savollar va e'lon berish suhbat ichida davom etadi.
 * Ish beruvchi rejimida qidiruv — ishchilar, bo'limlar — ishchilar bo'limlari.
 */
export function HomeStart({
  chat,
  mode,
  places,
  place: initialPlace,
  action,
  latest,
  introSeen,
}: {
  chat: GuidedChat;
  mode: QuickMode;
  places: QuickOption[];
  place: string;
  /** skriptlar yuklanmasdan yuborilsa — shu sahifaga ?q=…&region=… bilan (yuklangach o'zi qidiriladi) */
  action: string;
  /** eng yangi e'lonlar (oqim bilan keladi) */
  latest: ReactNode;
  /** video-tushuntirish ko'rilgan (cookie) */
  introSeen: boolean;
}) {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [place, setPlace] = useState(initialPlace);
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const jobs = mode === "jobs";
  const chosen = places.find((p) => p.value === place) ?? places[0];
  const hint = t("easy.guided.home.placeholder");

  return (
    <div className="flex flex-1 flex-col gap-5 py-4" data-guided-empty data-home-start={mode}>
      {/* birinchi marta — ovozli video-tushuntirish tepada ochiq (ega, 2026-11-22); ko'rilgach — pastda kichik tugma */}
      {introSeen ? null : (
        <div className="mx-auto w-full max-w-2xl">
          <ChatIntro seen={false} />
        </div>
      )}
      <div className="space-y-1.5">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-4xl xl:text-5xl">{t("easy.guided.home.title")}</h1>
        <p className="text-lg leading-snug text-muted-foreground">{t("easy.guided.home.subtitle")}</p>
      </div>

      <form
        action={action}
        method="get"
        role="search"
        aria-label={t("easy.guided.home.search_label")}
        onSubmit={(e) => {
          e.preventDefault();
          if (chosen) chat.find(q, chosen);
        }}
        className="grid grid-cols-1 gap-2 rounded-2xl border border-border bg-card p-3 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,1fr)_17rem_auto]"
        data-home-search
        data-hydrated={hydrated ? "" : undefined}
        data-tour="composer"
      >
        <div className="min-w-0 sm:col-span-2 xl:col-span-1">
          <label htmlFor="home-q" className="sr-only">
            {t(jobs ? "easy.guided.home.q_label_jobs" : "easy.guided.home.q_label_workers")}
          </label>
          {/*
            ko'rsatma (ega, 2026-11-23: "Yozing, o'zingizga mosini toping" — sig'sin): tor telefonda kesilmaydi, ikkinchi
            qatorga o'tadi. Ko'rinadigan matn — maydon ostidagi qatlam (maydon balandligi shunga qarab); maydonning o'z
            placeholder'i shaffof — ekran o'qigich uchun
          */}
          <div className="relative rounded-xl border border-input bg-card transition-colors focus-within:border-primary" data-home-field>
            <Search className="pointer-events-none absolute left-4 top-3.5 size-5 text-muted-foreground" aria-hidden />
            <span aria-hidden className={cn("pointer-events-none block min-h-12 py-3 pl-11 pr-3.5 text-base leading-6 text-muted-foreground", q && "invisible")} data-home-hint>
              {hint}
            </span>
            <input
              id="home-q"
              name="q"
              type="search"
              enterKeyHint="search"
              maxLength={120}
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={hint}
              className="absolute inset-0 size-full rounded-xl bg-transparent pl-11 pr-3.5 text-base text-foreground outline-none placeholder:text-transparent focus-visible:ring-2 focus-visible:ring-primary/20 [&::-webkit-search-cancel-button]:hidden"
              data-home-q
            />
          </div>
        </div>
        <div className="relative min-w-0">
          <label htmlFor="home-place" className="sr-only">
            {t("easy.guided.home.region_label")}
          </label>
          <MapPin className="pointer-events-none absolute left-4 top-1/2 z-10 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Select id="home-place" name="region" options={places} value={place} onChange={(e) => setPlace(e.target.value)} className="h-12 rounded-xl pl-11" data-home-place />
        </div>
        <Button type="submit" size="lg" className="h-12 shrink-0 rounded-xl px-6 text-base" disabled={chat.pending} data-home-submit>
          {t("easy.guided.home.search")}
        </Button>
      </form>

      <div className="grid grid-cols-3 gap-2" data-guided-starts>
        <Tile icon={BriefcaseBusiness} label={t("easy.guided.start_jobs")} disabled={chat.pending} onClick={() => chat.start("jobs", t("easy.guided.start_jobs"))} data-guided-start="jobs" data-tour="start-jobs" />
        <Tile icon={UsersRound} label={t("easy.guided.start_workers")} disabled={chat.pending} onClick={() => chat.start("workers", t("easy.guided.start_workers"))} data-guided-start="workers" data-tour="start-workers" />
        {/* sariq (ega tanlagan urg'u): kim ekani so'ralmaydi — ikkala variant chiqadi (o'zi haqida / vakansiya) */}
        <Tile icon={Plus} label={t("easy.guided.home.post")} accent disabled={chat.pending} onClick={() => chat.offerPost(t("easy.guided.home.post"))} data-guided-start="post" data-tour="post" />
      </div>

      <QuickLinks mode={mode} />

      {latest}

      {introSeen ? (
        <div className="flex justify-center">
          <ChatIntro seen />
        </div>
      ) : null}
    </div>
  );
}

function Tile({ icon: Icon, label, accent, ...props }: { icon: LucideIcon; label: string; accent?: boolean } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <button
      type="button"
      className={cn(
        // 320 px da uchta tugma yonma-yon: "qidiryapman" bo'linmasin — eng tor ekranda kichikroq yozuv
        "press flex min-h-24 min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border px-1 py-2.5 text-center text-xs font-bold leading-tight shadow-sm transition-colors [overflow-wrap:anywhere] disabled:opacity-60 min-[360px]:px-1.5 min-[360px]:text-sm sm:text-base",
        accent ? "border-highlight bg-highlight text-highlight-foreground hover:bg-highlight-hover" : "border-border-strong bg-card text-foreground hover:border-primary/50",
      )}
      {...props}
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", accent ? "bg-card text-foreground" : "bg-primary-soft text-primary-ink")} aria-hidden>
        <Icon className="size-5" />
      </span>
      {label}
    </button>
  );
}

/** Tezkor bo'limlar — mavjud sahifalar (qidiruv natijalari, talabalar, ustalar); hammasi oddiy havola */
function QuickLinks({ mode }: { mode: QuickMode }) {
  const { t } = useT();
  const everywhere = { region: null, district: null };
  const seek = Object.fromEntries(seekerQuickFilters(everywhere).map((f) => [f.key, f.href]));
  const hire = Object.fromEntries(employerQuickFilters(everywhere).map((f) => [f.key, f.href]));
  const links: { key: string; href: string; label: string; icon: LucideIcon }[] =
    mode === "jobs"
      ? [
          { key: "new", href: findHref(EMPTY_FIND, { mode: "jobs", any: true, region: "all" }), label: t("welcome.market.q_new"), icon: Sparkles },
          { key: "daily", href: seek.daily!, label: t("easy.sections.daily"), icon: CalendarClock },
          { key: "students", href: "/students", label: t("easy.guided.home.students"), icon: GraduationCap },
          { key: "masters", href: "/ustalar", label: t("masters.name"), icon: Hammer },
          { key: "remote", href: seek.remote!, label: t("easy.sections.remote"), icon: Laptop },
        ]
      : [
          { key: "workers", href: findHref(EMPTY_FIND, { mode: "workers", any: true, region: "all" }), label: t("easy.sections.all_workers"), icon: UsersRound },
          { key: "experienced", href: hire.experienced!, label: t("easy.sections.experienced"), icon: Award },
          { key: "near", href: hire.near!, label: t("easy.sections.near_workers"), icon: MapPin },
          { key: "masters", href: "/ustalar", label: t("masters.name"), icon: Hammer },
        ];
  return (
    <nav aria-label={t("easy.guided.home.quick_label")}>
      <ul className="flex flex-wrap gap-2" data-home-quick>
        {links.map((l) => (
          <li key={l.key} className="flex min-w-0">
            <Link
              href={l.href}
              prefetch={false}
              className="press inline-flex min-h-11 min-w-0 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-sm font-semibold text-foreground hover:border-primary/50 hover:text-primary-ink"
              data-track="entry_quick"
              data-track-to={l.key}
            >
              <l.icon className="size-4 shrink-0 text-primary-ink" aria-hidden />
              <span className="min-w-0 [overflow-wrap:anywhere]">{l.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
