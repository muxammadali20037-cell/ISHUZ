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
      // ish izlovchidagi bilan bir xil: tashqi karta yo'q ("oyna ustida oyna", ega 2026-11-17), sarlavha bitta qatorda (cqw)
      className="@container relative px-1 pt-1 sm:px-2"
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
          {greeting}
        </p>
        {extra}
      </div>
      <h1 id="home-title" className="mt-1 text-[min(1.75rem,8.2cqw)] font-extrabold leading-[1.1] tracking-tight sm:mt-1.5 sm:text-[min(3rem,8.2cqw)] lg:text-[min(3.5rem,8.2cqw)]">
        {t("easy.home2.e_title_a")}
        <span className="brand-text">{t("easy.home2.e_title_em")}</span>
        {t("easy.home2.e_title_b")}
      </h1>
      <div className="mt-4 max-w-2xl sm:mt-6">
        <TopSearch mode="workers" ai={home.aiButton} hero />
      </div>
      {/* asosiy amal — vakansiya joylash (ish izlovchidagi "+ E'lon joylash" bilan bir xil: 44 px, och ko'k; ega 2026-11-17) */}
      <div className="mt-2.5 max-w-2xl">
        <Link
          href="/post/vacancy?ai=1"
          prefetch={false}
          data-track="home_post_vacancy"
          data-track-to="ai"
          data-guide-entry
          data-home-post
          className="press flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary-soft px-4 text-base font-bold text-primary-ink hover:bg-primary/15"
        >
          <Plus className="size-5" strokeWidth={2.6} aria-hidden />
          {t("easy.start.post_vacancy")}
        </Link>
      </div>
    </section>
  );
}

