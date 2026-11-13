import Link from "next/link";
import { ArrowRight, Check, ChevronRight, Pencil, Sparkles } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/shared/category-icon";
import { SalaryText } from "@/components/shared/salary-text";
import { getCategories, type Category } from "@/lib/reference";
import type { SessionContext } from "@/features/auth/session";
import { getHomePlace } from "@/features/landing/home-queries";
import { searchVacancyCardsWithTotal } from "@/features/jobs/queries";
import { getMarketCounts } from "@/features/landing/market/queries";
import { getDailyPlan, getMyInterests, todayStartIso, type DailyStep } from "../queries";

const num = (n: number) => new Intl.NumberFormat("ru-RU").format(n);

/**
 * "Mening dunyom" (2026-11) — ish qidiruvchi bosh sahifasining shaxsiy qismi:
 *  - qiziqishlar tanlanmagan bo'lsa: "Dunyongizni yarating" taklifi (mehmonga ham — kirgach o'sha oqimga);
 *  - tanlangan bo'lsa: sohalar (bosiladi) va "Sozlash", har soha bo'yicha eng yangi haqiqiy e'lonlar (hududda, bo'lmasa butun
 *    mamlakatda) va soni;
 *  - kirgan foydalanuvchi: "Bugungi rejangiz" — haqiqiy holatdan kunlik qadamlar (saqlash, ariza — har kuni yangilanadi).
 * Migratsiya (0073) bo'lmasa — bo'lim yo'q.
 */
export async function MyWorld({ session }: { session: SessionContext | null }) {
  const interests = await getMyInterests(session?.userId);
  if (!interests.supported) return null;
  const has = interests.categories.length > 0;
  const plan = session ? await getDailyPlan(session, has) : null;
  if (!has) return <WorldInvite plan={plan} />;
  return <WorldHome categories={interests.categories} plan={plan} />;
}

async function WorldInvite({ plan }: { plan: DailyStep[] | null }) {
  const [{ t, name }, all] = await Promise.all([getT(), getCategories()]);
  const sample = all.slice(0, 5);
  return (
    <section aria-labelledby="world-invite" className={cn("grid gap-4", plan && "lg:grid-cols-[minmax(0,1fr)_22rem]")}>
      <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-primary-soft p-5 sm:p-6">
        <p className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-ink">
          <Sparkles className="size-4" aria-hidden />
          {t("easy.world.my_world")}
        </p>
        <h2 id="world-invite" className="mt-1.5 text-xl font-extrabold leading-tight tracking-tight sm:text-2xl">
          {t("easy.world.invite_title")}
        </h2>
        <p className="mt-1.5 max-w-xl text-base leading-relaxed text-muted-foreground">{t("easy.world.invite_desc")}</p>
        <ul className="mt-4 flex flex-wrap gap-2" aria-hidden>
          {sample.map((c) => (
            <li key={c.id} className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-semibold shadow-sm">
              <CategoryIcon name={c.icon} className="size-4 text-primary-ink" />
              {name(c)}
            </li>
          ))}
          <li className="inline-flex items-center rounded-full bg-card px-3 py-1.5 text-sm font-semibold text-muted-foreground shadow-sm">+{Math.max(0, all.length - sample.length)}</li>
        </ul>
        <Link
          href="/dunyo"
          data-track="home_cta"
          data-track-to="world"
          className="press mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-bold text-primary-foreground shadow-sm hover:bg-primary-hover"
        >
          {t("easy.world.invite_cta")} <ArrowRight className="size-5" aria-hidden />
        </Link>
      </div>
      {plan ? <DailyPlan steps={plan} /> : null}
    </section>
  );
}

async function WorldHome({ categories, plan }: { categories: Category[]; plan: DailyStep[] | null }) {
  const [{ t, name, locale }, place, counts] = await Promise.all([getT(), getHomePlace(), getMarketCounts()]);
  const shown = categories.slice(0, 3);
  const regionId = place.region?.id ?? null;
  // hududda yetarli e'lon bo'lmasa — butun O'zbekiston (bo'sh qator ko'rsatilmaydi)
  const feeds = await Promise.all(
    shown.map(async (c) => {
      const base = { p_category_id: c.id, p_sort: "newest" as const, p_limit: 3, p_offset: 0 };
      const local = regionId ? await searchVacancyCardsWithTotal({ ...base, p_region_id: regionId }) : null;
      const res = local && local.items.length ? local : await searchVacancyCardsWithTotal(base);
      return { category: c, res, local: !!(local && local.items.length) };
    }),
  );
  const total = feeds.reduce((a, f) => a + (f.res?.total ?? 0), 0);
  const today = todayStartIso();
  const ru = locale === "ru";
  return (
    <section aria-labelledby="world-title" className="space-y-4">
      <div className={cn("grid gap-4", plan && "lg:grid-cols-[minmax(0,1fr)_22rem]")}>
        <div className="flex flex-col rounded-2xl border border-border bg-card p-5 sm:p-6">
          <p className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-ink">
            <Sparkles className="size-4" aria-hidden />
            {t("easy.world.my_world")}
          </p>
          <h2 id="world-title" className="mt-1.5 text-xl font-extrabold leading-tight tracking-tight sm:text-2xl">
            {total > 0 ? t("easy.world.home_title", { count: num(total) }) : t("easy.world.home_title_empty")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{place.region ? t("easy.world.home_where", { place: name(place.region) }) : t("easy.world.home_where_all")}</p>
          {/* sohalar — plitkalar (bosiladi): nom va butun mamlakatdagi faol vakansiyalar soni */}
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {categories.map((c) => (
              <li key={c.id} className="flex">
                <Link
                  href={`/jobs?category=${c.slug}${place.region ? `&region=${place.region.slug}` : ""}`}
                  className="press flex w-full items-center gap-2.5 rounded-xl border border-border bg-background p-2.5 hover:border-primary/50"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-ink" aria-hidden>
                    <CategoryIcon name={c.icon} className="size-4.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{name(c)}</span>
                    {counts ? <span className="block text-xs text-muted-foreground">{t("easy.world.jobs_count", { count: num(counts.categories[c.id] ?? 0) })}</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {/* pastki qator: barcha yangi ishlar va dunyoni sozlash */}
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
            <Link
              href={`/jobs?sort=newest${place.region ? `&region=${place.region.slug}` : ""}`}
              className="press inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary-hover"
            >
              {t("easy.world.all_new")} <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href="/dunyo" className="press inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground">
              <Pencil className="size-4" aria-hidden />
              {t("easy.world.edit")}
            </Link>
          </div>
        </div>
        {plan ? <DailyPlan steps={plan} /> : null}
      </div>

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {feeds.map(({ category: c, res, local }) => {
          const href = `/jobs?category=${c.slug}${local && place.region ? `&region=${place.region.slug}` : ""}&sort=newest`;
          return (
            <li key={c.id} className="flex">
              <div className="flex w-full flex-col rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-ink" aria-hidden>
                    <CategoryIcon name={c.icon} className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-bold">{name(c)}</h3>
                    {res ? <p className="text-xs text-muted-foreground">{t("easy.world.jobs_count", { count: num(res.total) })}</p> : null}
                  </div>
                  <Link href={href} className="inline-flex min-h-11 items-center gap-0.5 text-sm font-semibold text-primary-ink hover:underline">
                    {t("easy.world.all")} <ChevronRight className="size-4" aria-hidden />
                  </Link>
                </div>
                {res && res.items.length ? (
                  <ul className="mt-2 divide-y divide-border">
                    {res.items.map((v) => {
                      const where = v.is_remote ? t("jobs.detail.remote") : (ru ? (v.district_name_ru ?? v.region_name_ru) : (v.district_name_uz ?? v.region_name_uz)) ?? "";
                      const fresh = !!v.published_at && v.published_at >= today;
                      return (
                        <li key={v.id}>
                          <Link href={`/jobs/${v.slug}`} className="block py-2.5 hover:text-primary-ink">
                            <span className="flex items-center gap-2">
                              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{v.title}</span>
                              {fresh ? <span className="shrink-0 rounded-full bg-success-soft px-2 py-0.5 text-2xs font-bold text-success">{t("easy.world.new")}</span> : null}
                            </span>
                            <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                              <SalaryText
                                from={v.salary_from}
                                to={v.salary_to}
                                type={v.salary_type}
                                negotiable={v.salary_negotiable}
                                className="shrink-0 font-bold text-foreground"
                              />
                              <span className="min-w-0 truncate">
                                {where}
                                {v.company_name ? ` · ${v.company_name}` : ""}
                              </span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-3 rounded-xl bg-secondary px-3 py-4 text-center text-sm text-muted-foreground">{res ? t("easy.world.row_empty") : t("easy.world.row_error")}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** "Bugungi rejangiz": qadamlar haqiqiy holatdan; bajarilgani — yashil belgi, qolgani — bosiladigan havola */
async function DailyPlan({ steps }: { steps: DailyStep[] }) {
  const { t } = await getT();
  const done = steps.filter((s) => s.done).length;
  const label = (s: DailyStep) =>
    s.key === "cv" && s.percent !== undefined && !s.done ? t("easy.world.plan_cv_percent", { percent: s.percent }) : t(`easy.world.plan_${s.key}${s.key === "cv" && s.percent === undefined ? "_new" : ""}`);
  return (
    <section aria-labelledby="world-plan" className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="world-plan" className="text-lg font-bold">
          {t("easy.world.plan_title")}
        </h2>
        <span className="tabular text-sm font-bold text-primary-ink">
          {done} / {steps.length}
        </span>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden>
        {steps.map((s) => (
          <span key={s.key} className={cn("h-1.5 flex-1 rounded-full", s.done ? "bg-success" : "bg-secondary")} />
        ))}
      </div>
      <ul className="mt-3 space-y-1">
        {steps.map((s) => (
          <li key={s.key}>
            {s.done ? (
              <p className="flex min-h-11 items-center gap-2.5 text-sm text-muted-foreground">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground" aria-hidden>
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                <span className="line-through decoration-muted-foreground/40">{label(s)}</span>
                <span className="sr-only">{t("easy.world.plan_done")}</span>
              </p>
            ) : (
              <Link href={s.href} className="group flex min-h-11 items-center gap-2.5 rounded-lg text-sm font-semibold hover:text-primary-ink">
                <span className="size-6 shrink-0 rounded-full border-2 border-border group-hover:border-primary" aria-hidden />
                <span className="min-w-0 flex-1">{label(s)}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground group-hover:text-primary-ink" aria-hidden />
              </Link>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-muted-foreground">{t("easy.world.plan_hint")}</p>
    </section>
  );
}
