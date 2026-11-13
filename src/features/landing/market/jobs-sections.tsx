import Link from "next/link";
import { ArrowRight, BadgeCheck, BriefcaseBusiness, Building2, Clock, MapPin, Wifi } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatRelative } from "@/lib/format";
import { searchVacancyCardsWithTotal } from "@/features/jobs/queries";
import { RetryButton } from "@/features/find/components/find-client";
import { SaveButton } from "@/features/saved/components/save-button";
import type { VacancyCardData } from "@/components/shared/vacancy-card";
import { SalaryText } from "@/components/shared/salary-text";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { SectionHead } from "./section-head";


type T = Awaited<ReturnType<typeof getT>>;

const hasSalary = (v: VacancyCardData) => !v.salary_negotiable && (!!v.salary_from || !!v.salary_to);


function placeOf(v: VacancyCardData, t: T["t"], locale: string): string {
  if (v.is_remote) return t("enums.employment_type.remote");
  const region = locale === "ru" ? v.region_name_ru : v.region_name_uz;
  const district = locale === "ru" ? v.district_name_ru : v.district_name_uz;
  return [district, region].filter(Boolean).join(", ");
}

/**
 * "Yangi vakansiyalar": eng yangi e'lonlar ro'yxati (logo · lavozim · kompaniya · shahar · maosh · ish turi · sana).
 * Xato — "bo'sh" deb ko'rsatilmaydi: tushuntirish va "Qayta urinish".
 */
export async function LatestJobs() {
  const [{ t, tEnum, locale }, res] = await Promise.all([getT(), searchVacancyCardsWithTotal({ p_sort: "newest", p_limit: 6 })]);
  const items = res?.items ?? [];
  return (
    <section id="yangi-ishlar" aria-labelledby="home-latest" className="container-wide scroll-mt-20 py-10 sm:py-14">
      <SectionHead
        id="home-latest"
        title={t("welcome.jobs.latest_title")}
        subtitle={t("welcome.jobs.latest_subtitle")}
        action={
          <Link href="/jobs?sort=newest" prefetch={false} className="inline-flex min-h-11 items-center gap-1.5 text-md font-semibold text-primary-ink hover:underline">
            {t("welcome.jobs.all_new")}
            <ArrowRight className="size-4.5" aria-hidden />
          </Link>
        }
      />
      {!res ? (
        <div role="alert" className="space-y-3 rounded-2xl border border-warning/40 bg-warning-soft p-5 text-center">
          <p className="text-lg font-semibold">{t("welcome.market.latest_error")}</p>
          <p className="text-muted-foreground">{t("welcome.market.latest_error_desc")}</p>
          <div className="mx-auto grid max-w-sm">
            <RetryButton label={t("easy.search.retry")} />
          </div>
        </div>
      ) : items.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {items.map((v) => {
            const place = placeOf(v, t, locale);
            const salary = (
              <SalaryText
                from={v.salary_from}
                to={v.salary_to}
                type={v.salary_type}
                negotiable={v.salary_negotiable}
                className={cn("text-base font-semibold", hasSalary(v) ? "text-foreground" : "text-muted-foreground")}
              />
            );
            return (
              <li key={v.id}>
                <article className="relative flex items-start gap-3 p-4 transition-colors hover:bg-background sm:items-center sm:gap-4 sm:px-5">
                  <Avatar src={v.company_logo_url} fallback={(v.company_name ?? v.title).slice(0, 2)} square size="lg" alt="" className="max-sm:size-11" />
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 break-words font-display text-base font-semibold leading-snug sm:line-clamp-1 sm:text-lg">
                      <Link href={`/jobs/${v.slug}`} prefetch={false} className="after:absolute after:inset-0">
                        {v.title}
                      </Link>
                    </h3>
                    <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <Building2 className="size-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{v.company_name ?? t("common.role.employer")}</span>
                        {v.company_verified ? <BadgeCheck className="size-4 shrink-0 text-primary-ink" role="img" aria-label={t("jobs.detail.company_verified")} /> : null}
                      </span>
                      {place ? (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          {v.is_remote ? <Wifi className="size-3.5 shrink-0" aria-hidden /> : <MapPin className="size-3.5 shrink-0" aria-hidden />}
                          <span className="truncate">{place}</span>
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1">
                        <BriefcaseBusiness className="size-3.5 shrink-0" aria-hidden />
                        {tEnum("employment_type", v.employment_type)}
                      </span>
                    </p>
                    {/* telefonda maosh (to'liq kenglikda) va sana — sarlavha ostida (o'ng ustun yo'q) */}
                    <div className="mt-2 sm:hidden">
                      {salary}
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3.5" aria-hidden />
                        {formatRelative(v.published_at, locale)}
                      </p>
                    </div>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    {salary}
                    <p className="mt-0.5 text-sm text-muted-foreground">{formatRelative(v.published_at, locale)}</p>
                  </div>
                  <SaveButton kind="vacancy" id={v.id} initial={!!v.is_saved} label={v.title} variant="ghost" className="relative z-10 -mr-2 max-sm:-mt-2" />
                </article>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
          <p className="text-lg font-semibold">{t("welcome.market.latest_empty")}</p>
          <p className="mt-1 text-muted-foreground">{t("welcome.market.latest_empty_desc")}</p>
          <Link href="/post/vacancy" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-md font-medium text-primary-foreground hover:bg-primary-hover">
            {t("welcome.market.latest_empty_post")}
          </Link>
        </div>
      )}
    </section>
  );
}
