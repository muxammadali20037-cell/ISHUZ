import Link from "next/link";
import { ArrowRight, BadgeCheck, BriefcaseBusiness, Building2, Clock, LockKeyhole, MapPin, ShieldCheck, Wifi } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getCategories } from "@/lib/reference";
import { formatRelative } from "@/lib/format";
import { searchVacancyCards, searchVacancyCardsWithTotal } from "@/features/jobs/queries";
import { RetryButton } from "@/features/find/components/find-client";
import { getDirectoryCompanies } from "@/features/companies/queries";
import { SaveButton } from "@/features/saved/components/save-button";
import type { VacancyCardData } from "@/components/shared/vacancy-card";
import { SalaryText } from "@/components/shared/salary-text";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { SectionHead } from "./section-head";

const num = (n: number) => new Intl.NumberFormat("ru-RU").format(n);
const EXP_STEPS = [60, 36, 24, 12, 6] as const;

type T = Awaited<ReturnType<typeof getT>>;

const hasSalary = (v: VacancyCardData) => !v.salary_negotiable && (!!v.salary_from || !!v.salary_to);
/** to'rga to'liq qatorlar: 8, 4 yoki 2 ta */
const fit = <X,>(list: X[]) => list.slice(0, list.length >= 8 ? 8 : list.length >= 4 ? 4 : 2);

function placeOf(v: VacancyCardData, t: T["t"], locale: string): string {
  if (v.is_remote) return t("enums.employment_type.remote");
  const region = locale === "ru" ? v.region_name_ru : v.region_name_uz;
  const district = locale === "ru" ? v.district_name_ru : v.district_name_uz;
  return [district, region].filter(Boolean).join(", ");
}

function experienceOf(v: VacancyCardData, t: T["t"], tEnum: T["tEnum"]): string | null {
  if (v.experience_min_months == null) return null;
  if (v.experience_min_months === 0) return t("easy.card.no_experience");
  const step = EXP_STEPS.find((m) => (v.experience_min_months ?? 0) >= m) ?? 6;
  return t("easy.card.experience", { value: tEnum("experience_min_months", String(step)) });
}

/**
 * "Tanlangan vakansiyalar": qoida ochiq yoziladi — tasdiqlangan ish beruvchilardan, maoshi ko'rsatilgan e'lonlar (TOP —
 * birinchi). Ular kam bo'lsa — maoshi ko'rsatilgan barcha e'lonlar (sarlavha izohi shunga mos). 2 tadan kam — bo'lim yo'q.
 */
async function pickFeatured(): Promise<{ items: VacancyCardData[]; verified: boolean } | null> {
  const verified = (await searchVacancyCards({ p_verified_only: true, p_sort: "relevant", p_limit: 16 })).filter(hasSalary);
  if (verified.length >= 4) return { items: fit(verified), verified: true };
  const all = (await searchVacancyCards({ p_sort: "relevant", p_limit: 24 })).filter(hasSalary);
  return all.length >= 2 ? { items: fit(all), verified: false } : null;
}

export async function FeaturedJobs() {
  const [tr, picked, categories] = await Promise.all([getT(), pickFeatured(), getCategories()]);
  if (!picked) return null;
  const { t, tEnum, name, locale } = tr;
  const catName = new Map(categories.map((c) => [c.slug, name(c)]));
  return (
    <section id="tanlangan" aria-labelledby="home-featured" className="container-app scroll-mt-20 py-10 sm:py-14">
      <SectionHead
        id="home-featured"
        title={t("welcome.jobs.featured_title")}
        subtitle={picked.verified ? t("welcome.jobs.featured_rule_verified") : t("welcome.jobs.featured_rule_salary")}
        action={
          <Link href={picked.verified ? "/jobs?verified=1" : "/jobs"} prefetch={false} className="inline-flex min-h-11 items-center gap-1.5 text-md font-semibold text-primary-ink hover:underline">
            {t("welcome.jobs.all")}
            <ArrowRight className="size-4.5" aria-hidden />
          </Link>
        }
      />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {picked.items.map((v) => {
          const place = placeOf(v, t, locale);
          const exp = experienceOf(v, t, tEnum);
          const cat = v.category_slug ? catName.get(v.category_slug) : null;
          return (
            <li key={v.id} className="flex">
              <article className="relative flex w-full flex-col rounded-2xl border border-border bg-card p-4 transition-[border-color,box-shadow] duration-200 hover:border-primary/40 hover:shadow-md sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <Avatar src={v.company_logo_url} fallback={(v.company_name ?? v.title).slice(0, 2)} square size="lg" alt="" />
                  <SaveButton kind="vacancy" id={v.id} initial={!!v.is_saved} label={v.title} variant="ghost" className="relative z-10 -mr-2 -mt-1" />
                </div>
                <h3 className="mt-4 line-clamp-2 break-words font-display text-lg font-semibold leading-snug">
                  <Link href={`/jobs/${v.slug}`} prefetch={false} className="after:absolute after:inset-0 after:rounded-2xl">
                    {v.title}
                  </Link>
                </h3>
                <p className="mt-1 flex min-w-0 items-center gap-1 text-sm font-medium text-foreground">
                  <span className="truncate">{v.company_name ?? t("common.role.employer")}</span>
                  {v.company_verified ? <BadgeCheck className="size-4 shrink-0 text-primary-ink" role="img" aria-label={t("jobs.detail.company_verified")} /> : null}
                </p>
                {place ? (
                  <p className="mt-0.5 flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
                    {v.is_remote ? <Wifi className="size-3.5 shrink-0" aria-hidden /> : <MapPin className="size-3.5 shrink-0" aria-hidden />}
                    <span className="truncate">{place}</span>
                  </p>
                ) : null}
                <ul className="mb-4 mt-3 flex flex-wrap gap-1.5" aria-label={t("welcome.jobs.tags_label")}>
                  {v.is_featured ? <li className="rounded-md bg-highlight px-2 py-1 text-xs font-semibold text-highlight-foreground">{t("easy.card.featured")}</li> : null}
                  <li className="rounded-md bg-primary-soft px-2 py-1 text-xs font-medium text-primary-ink">{tEnum("employment_type", v.employment_type)}</li>
                  {cat ? <li className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">{cat}</li> : null}
                  {exp ? <li className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">{exp}</li> : null}
                </ul>
                <div className="mt-auto border-t border-border pt-3">
                  <SalaryText from={v.salary_from} to={v.salary_to} type={v.salary_type} negotiable={v.salary_negotiable} className="block text-md font-semibold text-foreground" />
                  <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3.5" aria-hidden />
                    {formatRelative(v.published_at, locale)}
                  </p>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * "Yangi vakansiyalar": eng yangi e'lonlar ro'yxati (logo · lavozim · kompaniya · shahar · maosh · ish turi · sana).
 * Xato — "bo'sh" deb ko'rsatilmaydi: tushuntirish va "Qayta urinish".
 */
export async function LatestJobs() {
  const [{ t, tEnum, locale }, res] = await Promise.all([getT(), searchVacancyCardsWithTotal({ p_sort: "newest", p_limit: 6 })]);
  const items = res?.items ?? [];
  return (
    <section id="yangi-ishlar" aria-labelledby="home-latest" className="container-app scroll-mt-20 py-10 sm:py-14">
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

/**
 * "Ishonchli ish beruvchilar": faqat hujjatlari tekshirilgan (verification_status = verified) va hozir faol vakansiyasi bor
 * kompaniyalar (0071 public_companies). Soxta logotip yo'q: logo yo'q bo'lsa — nomining bosh harflari. Ostida — platformadagi
 * haqiqiy himoya qoidalari (moderatsiya, telefon raqami maxfiyligi). Kompaniya topilmasa — faqat qoidalar.
 */
export async function TrustedEmployers() {
  const [{ t }, directory] = await Promise.all([getT(), getDirectoryCompanies({ q: "", regionId: null, page: 1 })]);
  const companies = (directory?.items ?? []).filter((c) => c.verified).slice(0, 8);
  const shown = companies.length >= 2 ? companies.slice(0, companies.length >= 8 ? 8 : companies.length >= 4 ? 4 : 2) : [];
  const rules = [
    { icon: BadgeCheck, title: t("welcome.trust.verified_title"), desc: t("welcome.trust.verified_desc") },
    { icon: ShieldCheck, title: t("welcome.trust.moderation_title"), desc: t("welcome.trust.moderation_desc") },
    { icon: LockKeyhole, title: t("welcome.trust.privacy_title"), desc: t("welcome.trust.privacy_desc") },
  ];
  return (
    <section aria-labelledby="home-trust" className="container-app py-10 sm:py-14">
      <SectionHead
        id="home-trust"
        title={shown.length ? t("welcome.trust.title") : t("welcome.trust.title_rules")}
        subtitle={shown.length ? t("welcome.trust.subtitle") : undefined}
        action={
          shown.length ? (
            <Link href="/companies" className="inline-flex min-h-11 items-center gap-1.5 text-md font-semibold text-primary-ink hover:underline">
              {t("welcome.trust.all_companies")}
              <ArrowRight className="size-4.5" aria-hidden />
            </Link>
          ) : undefined
        }
      />
      {shown.length ? (
        <ul className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((c) => (
            <li key={c.id} className="flex">
              <Link
                href={`/company/${c.slug}`}
                prefetch={false}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-md"
              >
                <Avatar src={c.logoUrl} fallback={c.name.slice(0, 2)} square size="lg" alt="" />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1 font-semibold">
                    <span className="truncate">{c.name}</span>
                    <BadgeCheck className="size-4 shrink-0 text-primary-ink" role="img" aria-label={t("jobs.detail.company_verified")} />
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{t("welcome.trust.company_jobs", { count: num(c.activeJobs) })}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {rules.map((r) => (
          <li key={r.title} className="flex gap-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success" aria-hidden>
              <r.icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold leading-snug">{r.title}</span>
              <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{r.desc}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
