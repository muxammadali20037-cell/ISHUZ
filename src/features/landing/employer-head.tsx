import type { ReactNode } from "react";
import Link from "next/link";
import { BadgeCheck, CalendarDays, ChevronRight, Laptop, MapPin, Plus, Sparkles } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";
import { getHomeSettings } from "@/features/home-windows/queries";
import { AiFinder } from "@/features/find/components/ai-finder";
import { cn } from "@/lib/utils";
import { SeekerSearch } from "./home-search";
import type { HomePlace } from "./home-queries";
import { employerServiceHrefs, placeChooserHref } from "./quick-filters";

/**
 * Bosh qism (mehmon va panel uchun bir xil): salom, savol, AI qidiruv maydoni, 4 ta tez yo'l, "Vakansiya joylash".
 * `extra` — panelda: kompaniya nomi va tasdiq belgisi.
 */
export async function EmployerHead({ flush, greeting, place, postHref, extra }: { flush?: boolean; greeting: string; place: HomePlace; postHref: string; extra?: ReactNode }) {
  const [{ t, name }, home] = await Promise.all([getT(), getHomeSettings()]);
  const where = { region: place.region?.slug ?? null, district: place.district?.id ?? null };
  const hrefs = employerServiceHrefs(where);
  const placeLabel = place.region ? (place.district ? `${name(place.region)} · ${name(place.district)}` : name(place.region)) : t("easy.location.whole_country");
  const shortcuts = [
    { key: "daily", href: hrefs.daily, label: t("easy.sections.daily_workers"), icon: CalendarDays },
    { key: "near", href: hrefs.near, label: t("easy.sections.near"), icon: MapPin },
    { key: "experienced", href: hrefs.experienced, label: t("easy.sections.experienced"), icon: BadgeCheck },
    { key: "remote", href: hrefs.remote, label: t("easy.sections.remote"), icon: Laptop },
  ];
  return (
    <section
      aria-labelledby="home-title"
      data-home="employer-v2"
      className={cn("border-border bg-card px-4 py-6 sm:rounded-2xl sm:border sm:px-8 sm:py-8", flush ? "-mx-4 -mt-4 border-b sm:mx-0 sm:mt-0" : "rounded-2xl border")}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm font-medium text-muted-foreground">{greeting}</p>
        {extra}
      </div>
      <h1 id="home-title" className="mt-1 text-2xl font-bold leading-tight tracking-tight text-navy dark:text-foreground sm:text-3xl">
        {t("easy.home2.e_title")}
      </h1>
      <p className="mt-1 text-base text-muted-foreground">{t("easy.home2.e_hint")}</p>
      <div className="mt-4 max-w-3xl">
        {home.aiButton ? (
          <AiFinder variant="field" defaultMode="workers" locked fieldLabel={t("easy.home2.e_title")} placeholder={t("easy.home2.e_placeholder")} submitLabel={t("easy.home2.submit")} />
        ) : (
          <SeekerSearch
            scope="workers"
            label={t("easy.start.employer_search_label")}
            placeholder={t("easy.start.employer_search_placeholder")}
            place={{ label: placeLabel, href: placeChooserHref("workers"), ...where }}
            filtersHref={hrefs.candidates}
            ai={false}
          />
        )}
      </div>
      <nav aria-label={t("easy.home2.shortcuts")} className="mt-4">
        <ul className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {shortcuts.map(({ key, href, label, icon: Icon }) => (
            <li key={key} className="flex">
              <Link
                href={href}
                prefetch={false}
                data-track="home_service"
                data-track-to={key}
                className="press inline-flex min-h-11 w-full items-center gap-2 rounded-md border border-border bg-background px-3.5 text-sm font-semibold hover:border-primary/50 hover:text-primary-ink"
              >
                <Icon className="size-4 shrink-0 text-primary-ink" aria-hidden /> {label}
              </Link>
            </li>
          ))}
        </ul>
        <Link href={hrefs.candidates} prefetch={false} data-track="direction_select" className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary-ink hover:underline">
          {t("easy.home2.e_all")} <ChevronRight className="size-4" aria-hidden />
        </Link>
      </nav>
      {/* ish beruvchining asl maqsadi — vakansiya joylash: alohida, katta, ko'k */}
      <div className="mt-5 flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary-soft p-4 sm:flex-row sm:items-center">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground" aria-hidden>
          <Sparkles className="size-5" />
        </span>
        <p className="min-w-0 flex-1 text-sm leading-snug text-foreground">{t("easy.home2.e_post_hint")}</p>
        <Button asChild size="lg" className="shrink-0 text-base font-bold">
          <Link href={postHref} data-track="home_post_vacancy">
            <Plus className="size-5" aria-hidden /> {t("easy.start.post_vacancy")}
          </Link>
        </Button>
      </div>
    </section>
  );
}

