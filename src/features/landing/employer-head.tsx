import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { BadgeCheck, CalendarDays, ChevronRight, Laptop, MapPin, Plus, Sparkles } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";
import { getHomeSettings } from "@/features/home-windows/queries";
import { AiFinder } from "@/features/find/components/ai-finder";
import { TINT_TILE, tintAt } from "@/components/shared/tints";
import { cn } from "@/lib/utils";
import { AiAvatar } from "@/components/shared/ai-avatar";
import { SeekerSearch } from "./home-search";
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
      className={cn("border-border bg-card px-4 py-6 sm:rounded-2xl sm:border sm:px-8 sm:py-8", flush ? "-mx-4 -mt-4 max-sm:bg-transparent sm:mx-0 sm:mt-0" : "rounded-2xl border")}
    >
      {/* "Ish Topdim" hikoyalari — eng tepada (bo'lmasa — joy ham qolmaydi) */}
      <Suspense fallback={null}>
        <StoriesRow mode="employer" className="mb-4" />
      </Suspense>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm font-medium text-muted-foreground">{greeting}</p>
        {extra}
      </div>
      <h1 id="home-title" className="mt-1 text-2xl font-bold leading-tight tracking-tight text-navy dark:text-foreground sm:text-3xl">
        {t("easy.home2.e_title")}
      </h1>
      {/* izoh — planshet va kompyuterda; telefonda ortiqcha yozuv yo'q (ega, 2026-11-15) */}
      <p className="mt-1 text-base text-muted-foreground max-md:hidden">{t("easy.home2.e_hint")}</p>
      {/* telefonda qidiruv sarlavhada (TopSearch, Uzum kabi) — bu yerda takrorlanmaydi */}
      <div className="mt-4 max-w-3xl max-lg:hidden">
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
          {shortcuts.map(({ key, href, label, icon: Icon }, i) => (
            <li key={key} className="flex">
              <Link
                href={href}
                prefetch={false}
                data-track="home_service"
                data-track-to={key}
                className="press inline-flex min-h-14 w-full min-w-0 items-center gap-2.5 rounded-xl border border-border/70 bg-card px-2.5 py-2 text-sm font-semibold leading-tight shadow-sm hover:border-primary/50 hover:text-primary-ink"
              >
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", TINT_TILE[tintAt(i)])} aria-hidden>
                  <Icon className="size-5" />
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

