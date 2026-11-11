import Link from "next/link";
import { BadgeCheck, ChevronRight, CircleSlash, MapPin, PauseCircle, Search } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";
import { SalaryText } from "@/components/shared/salary-text";
import { getActiveSimilar, type VacancyStub } from "../queries";

/**
 * Yopilgan / muddati o'tgan / to'xtatilgan vakansiya (0069): ulashilgan havola 404 emas — nima bo'lganini aytadi va
 * keyingi qadamni beradi (o'xshash faol ishlar, shu soha bo'yicha qidiruv, kompaniya sahifasi). Ariza tugmasi yo'q.
 */
export async function ClosedVacancy({ stub }: { stub: VacancyStub }) {
  const [{ t, name, locale }, similar] = await Promise.all([getT(), getActiveSimilar({ categoryId: stub.category_id, regionId: stub.region_id, excludeSlug: stub.slug })]);
  const Icon = stub.status === "paused" ? PauseCircle : CircleSlash;
  const place = stub.is_remote ? t("jobs.detail.remote") : [name(stub.district), name(stub.region)].filter(Boolean).join(", ");
  const searchHref = stub.category ? `/jobs?category=${stub.category.slug}${stub.region ? `&region=${stub.region.slug}` : ""}` : "/jobs";

  return (
    <div className="container-narrow py-6">
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6" aria-labelledby="closed-title">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-muted-foreground">
          <Icon className="size-4" aria-hidden />
          {t(`jobs.closed.badge_${stub.status}`)}
        </p>
        <h1 id="closed-title" className="mt-3 text-2xl font-extrabold leading-tight">
          {stub.title}
        </h1>
        <div className="mt-2 space-y-1 text-base text-muted-foreground">
          {stub.company ? (
            <p className="flex items-center gap-1.5">
              <Link href={`/company/${stub.company.slug}`} className="font-semibold text-foreground hover:underline">
                {stub.company.name}
              </Link>
              {stub.company.verified ? <BadgeCheck className="size-4 text-primary-ink" aria-label={t("jobs.closed.verified")} /> : null}
            </p>
          ) : null}
          {place ? (
            <p className="flex items-center gap-1.5">
              <MapPin className="size-4 shrink-0" aria-hidden />
              {place}
            </p>
          ) : null}
        </div>
        <p className="mt-4 rounded-xl bg-secondary p-3 text-base">{t(`jobs.closed.text_${stub.status}`)}</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button asChild size="lg">
            <Link href={searchHref}>
              <Search className="size-5" aria-hidden />
              {stub.category ? t("jobs.closed.search_category", { category: name(stub.category) }) : t("jobs.closed.search_all")}
            </Link>
          </Button>
          {stub.company ? (
            <Button asChild size="lg" variant="outline">
              <Link href={`/company/${stub.company.slug}`}>{t("jobs.closed.company_jobs")}</Link>
            </Button>
          ) : null}
        </div>
      </section>

      {similar.length ? (
        <section className="mt-6" aria-labelledby="closed-similar">
          <h2 id="closed-similar" className="mb-3 text-lg font-bold">
            {t("jobs.closed.similar")}
          </h2>
          <ul className="grid gap-2">
            {similar.map((v) => (
              <li key={v.id}>
                <Link href={`/jobs/${v.slug}`} className="press flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 hover:border-primary/50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-bold leading-snug">{v.title}</span>
                    <SalaryText from={v.salary_from} to={v.salary_to} type={v.salary_type} negotiable={v.salary_negotiable} className="block truncate text-sm font-bold text-primary-ink" />
                    <span className="block truncate text-sm text-muted-foreground">
                      {v.is_remote
                        ? t("jobs.detail.remote")
                        : (locale === "ru" ? [v.district_name_ru ?? v.district_name_uz, v.region_name_ru ?? v.region_name_uz] : [v.district_name_uz, v.region_name_uz]).filter(Boolean).join(", ")}
                      {v.company_name ? ` · ${v.company_name}` : ""}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
