import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, MapPin, Plus } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getHomeSettings } from "@/features/home-windows/queries";
import { TopSearch } from "@/features/find/components/top-search";
import type { HomePlace } from "./home-queries";
import { placeChooserHref } from "./quick-filters";
import { StoriesRow } from "@/features/stories/components/stories-row";

/**
 * Bosh qism (mehmon va panel uchun bir xil) — ish izlovchidagidek sodda (ega, 2026-11-17: "ish beruvchi panelini ham
 * shunaqa sodda qil"): joylashuv, salom, savol, qidiruv maydoni va katta "+ Vakansiya joylash" (yordamchi bilan: bir gap
 * yozadi, qolganini o'zi so'raydi). Tez yo'llar (kunlik, masofaviy, tajribali, yaqin atrofdagi ishchi, barcha nomzodlar) —
 * pastdagi "Bo'limlar" ro'yxatida. `extra` — panelda: kompaniya nomi va tasdiq belgisi.
 */
export async function EmployerHead({ flush, greeting, place, extra }: { flush?: boolean; greeting: string; place: HomePlace; extra?: ReactNode }) {
  const [{ t, name }, home] = await Promise.all([getT(), getHomeSettings()]);
  const placeLabel = place.region ? (place.district ? `${name(place.region)} · ${name(place.district)}` : name(place.region)) : t("easy.location.whole_country");
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
      {/* asosiy amal — vakansiya joylash: katta, gradientli (ish izlovchidagi "+ E'lon joylash" bilan bir xil) */}
      <div className="mt-3 max-w-2xl">
        <Link
          href="/post/vacancy?ai=1"
          prefetch={false}
          data-track="home_post_vacancy"
          data-track-to="ai"
          data-guide-entry
          data-home-post
          className="press brand-fill flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 text-lg font-extrabold shadow-glow hover:opacity-95"
        >
          <span className="flex size-8 items-center justify-center rounded-full border-2 border-current" aria-hidden>
            <Plus className="size-5" strokeWidth={3} />
          </span>
          {t("easy.start.post_vacancy")}
        </Link>
      </div>
    </section>
  );
}

