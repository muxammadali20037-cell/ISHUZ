import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { BadgeCheck, CalendarDays, ChevronDown, ChevronRight, Laptop, MapPin, Plus, Sparkles } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";
import { getHomeSettings } from "@/features/home-windows/queries";
import { TopSearch } from "@/features/find/components/top-search";
import { TINT_TILE, tintAt } from "@/components/shared/tints";
import { cn } from "@/lib/utils";
import { AiAvatar } from "@/components/shared/ai-avatar";
import type { HomePlace } from "./home-queries";
import { employerServiceHrefs, placeChooserHref } from "./quick-filters";
import { StoriesRow } from "@/features/stories/components/stories-row";

/**
 * Bosh qism (mehmon va panel uchun bir xil): salom, savol, AI qidiruv maydoni, 4 ta tez yo'l, "Vakansiya joylash".
 * `extra` — panelda: kompaniya nomi va tasdiq belgisi.
 */
export async function EmployerHead({
  flush,
  greeting,
  place,
  postHref,
  extra,
  menu = false,
}: {
  flush?: boolean;
  greeting: string;
  place: HomePlace;
  postHref: string;
  extra?: ReactNode;
  /** kirgan foydalanuvchi: telefonda pastda "Bo'limlar" menyusi bor — takrorlanadigan havolalar telefonda yashiriladi */
  menu?: boolean;
}) {
  const [{ t, name }, home] = await Promise.all([getT(), getHomeSettings()]);
  const where = { region: place.region?.slug ?? null, district: place.district?.id ?? null };
  const hrefs = employerServiceHrefs(where);
  const placeLabel = place.region ? (place.district ? `${name(place.region)} · ${name(place.district)}` : name(place.region)) : t("easy.location.whole_country");
  const shortcuts = [
    // har birida "ishchi" so'zi — ish beruvchi ishchi qidiradi (ega, 2026-11-14); ish izlovchida xuddi shu joyda "… ish"
    { key: "daily", href: hrefs.daily, label: t("easy.chips.emp_daily"), icon: CalendarDays },
    { key: "near", href: hrefs.near, label: t("easy.chips.emp_near"), icon: MapPin },
    { key: "experienced", href: hrefs.experienced, label: t("easy.chips.emp_exp"), icon: BadgeCheck },
    { key: "remote", href: hrefs.remote, label: t("easy.chips.emp_remote"), icon: Laptop },
  ];
  return (
    <section
      aria-labelledby="home-title"
      data-home="employer-v2"
      // 5.0 (ega "ko'k-oq" dizayni): katta oq qidiruv bloki — ish izlovchidagi bilan bir xil tartib
      className="hero-glow relative overflow-hidden rounded-hero border border-border bg-card px-5 py-5 shadow-card sm:px-10 sm:py-10"
      data-flush={flush ? "" : undefined}
    >
      {/* "Ish Topdim" hikoyalari — eng tepada (bo'lmasa — joy ham qolmaydi) */}
      <Suspense fallback={null}>
        <StoriesRow mode="employer" className="mb-4" />
      </Suspense>
      <Link
        href={placeChooserHref("workers")}
        prefetch={false}
        data-home-place
        aria-label={t("easy.start.place_label", { place: placeLabel })}
        className="press inline-flex h-11 max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-4 text-sm font-semibold hover:border-primary/40"
      >
        <MapPin className="size-4 shrink-0 text-primary-ink" aria-hidden />
        <span className="truncate">{placeLabel}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:mt-6">
        <p className="text-sm font-medium text-muted-foreground">
          {greeting} <span aria-hidden>👋</span>
        </p>
        {extra}
      </div>
      <h1 id="home-title" className="mt-1 text-[2rem] font-extrabold leading-[1.08] tracking-tight sm:mt-1.5 sm:text-5xl lg:text-6xl">
        {t("easy.home2.e_title_a")}
        <span className="brand-text">{t("easy.home2.e_title_em")}</span>
        {t("easy.home2.e_title_b")}
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:mt-3 sm:text-base">{t("easy.home2.e_hint")}</p>
      <div className="mt-4 max-w-2xl sm:mt-6">
        <TopSearch mode="workers" ai={home.aiButton} hero />
      </div>
      <nav aria-label={t("easy.home2.shortcuts")} className="mt-4">
        <ul className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {shortcuts.map(({ key, href, label, icon: Icon }, i) => (
            <li key={key} className="flex">
              <Link
                href={href}
                prefetch={false}
                data-track="home_service"
                data-track-to={key}
                className="press inline-flex min-h-12 w-full items-center gap-2.5 rounded-xl border border-border bg-card py-2 pl-2 pr-3 text-sm font-semibold leading-tight shadow-card hover:border-primary/40 sm:w-auto sm:pr-4"
              >
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", TINT_TILE[(["blue", "blue", "green", "orange"] as const)[i] ?? tintAt(i)])} aria-hidden>
                  <Icon className="size-4.5" />
                </span>{" "}
                <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href={hrefs.candidates}
          prefetch={false}
          data-track="direction_select"
          className={cn("mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary-ink hover:underline", menu && "max-lg:hidden")}
        >
          {t("easy.home2.e_all")} <ChevronRight className="size-4" aria-hidden />
        </Link>
      </nav>
      {/* "AI bilan oson joylash" — alohida ajralib turadi (ega, 2026-11-16): bir gap yozadi, qolganini savollar bilan tanlaydi */}
      <Link
        href="/post/vacancy?ai=1"
        prefetch={false}
        data-track="home_post_vacancy"
        data-track-to="ai"
        data-guide-entry
        className="press mt-5 flex items-center gap-3 rounded-2xl border-2 border-ai/40 bg-ai-soft px-4 py-3.5 hover:border-ai"
      >
        <AiAvatar size="md" />
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-extrabold leading-snug text-foreground">{t("easy.vguide.entry_title")}</span>
          <span className="block text-sm text-muted-foreground">{t("easy.vguide.entry_desc")}</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-ai" aria-hidden />
      </Link>
      {/* ish beruvchining asl maqsadi — vakansiya joylash: alohida, katta, ko'k */}
      {/* telefonda — faqat katta tugma (izohsiz) */}
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:rounded-xl sm:border sm:border-primary/25 sm:bg-primary-soft sm:p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground max-sm:hidden" aria-hidden>
          <Sparkles className="size-5" />
        </span>
        <p className="min-w-0 flex-1 text-sm leading-snug text-foreground max-sm:hidden">{t("easy.home2.e_post_hint")}</p>
        <Button asChild size="lg" className="h-12 shrink-0 text-base font-bold max-sm:w-full">
          <Link href={postHref} data-track="home_post_vacancy">
            <Plus className="size-5" aria-hidden /> {t("easy.start.post_vacancy")}
          </Link>
        </Button>
      </div>
    </section>
  );
}

