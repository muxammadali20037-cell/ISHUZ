import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, FlaskConical } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getCategories } from "@/lib/reference";
import { Button } from "@/components/ui/button";
import { getDemoVacancies } from "@/features/demo-vacancies/queries";
import { DEMO_VACANCIES_PAGE } from "@/features/demo-vacancies/types";
import { DemoJobCard } from "@/features/demo-vacancies/components/demo-job-card";

type Search = Promise<{ soha?: string | string[]; page?: string | string[] }>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  // namuna e'lonlar qidiruv tizimlariga chiqmaydi (haqiqiy ish emas)
  return { title: t("demo.list_title"), description: t("demo.list_subtitle"), robots: { index: false, follow: false } };
}

/**
 * /jobs/namuna — barcha namuna (demo) vakansiyalar: har sohada 4 tadan (0077, alohida jadval). Soha bo'yicha saralash (JS'siz
 * ishlaydi), sahifalash. Sahifa boshida — bular haqiqiy ish emasligi; "Haqiqiy vakansiyalar" — /jobs.
 */
export default async function DemoVacanciesPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const [{ t, name }, categories] = await Promise.all([getT(), getCategories()]);
  const category = categories.find((c) => c.slug === one(sp.soha)) ?? null;
  const page = Math.min(Math.max(Number.parseInt(one(sp.page), 10) || 1, 1), 50);
  const list = await getDemoVacancies({ category: category?.slug ?? null, limit: DEMO_VACANCIES_PAGE, offset: (page - 1) * DEMO_VACANCIES_PAGE });
  const pages = Math.max(1, Math.ceil(list.total / DEMO_VACANCIES_PAGE));
  const href = (p: number) => {
    const q = new URLSearchParams();
    if (category) q.set("soha", category.slug);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `/jobs/namuna?${s}` : "/jobs/namuna";
  };
  return (
    <>
      <div className="container-wide space-y-5 py-5 sm:py-8" data-demo-list>
        <header className="max-w-3xl">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            <FlaskConical className="size-6 shrink-0 text-muted-foreground" aria-hidden /> {t("demo.list_title")}
          </h1>
          <p className="mt-2 text-base text-muted-foreground" data-demo-note>
            {t("demo.list_subtitle")}
          </p>
          <Link href="/jobs" className="mt-2 inline-flex min-h-11 items-center gap-1 text-base font-semibold text-primary-ink hover:underline">
            {t("demo.real_jobs")} <ChevronRight className="size-4" aria-hidden />
          </Link>
        </header>

        <form action="/jobs/namuna" method="get" className="flex flex-wrap items-end gap-2" data-demo-filter>
          <label className="min-w-0 flex-1 sm:max-w-sm">
            <span className="mb-1 block text-sm font-semibold">{t("demo.list_field")}</span>
            <select name="soha" defaultValue={category?.slug ?? ""} className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base">
              <option value="">{t("demo.list_all")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {name(c)}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="outline" className="h-12 px-5 text-base">
            {t("demo.view")}
          </Button>
        </form>

        {list.items.length ? (
          <>
            <p className="text-sm font-semibold" data-demo-count>
              {t("demo.list_count", { count: list.total })}
            </p>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4 4xl:grid-cols-5">
              {list.items.map((job) => (
                <li key={job.id} className="flex [&>article]:w-full">
                  <DemoJobCard job={job} />
                </li>
              ))}
            </ul>
            {pages > 1 ? (
              <nav aria-label={t("demo.list_title")} className="flex items-center justify-between gap-3">
                {page > 1 ? (
                  <Button asChild variant="outline" className="h-11">
                    <Link href={href(page - 1)} rel="prev">
                      <ChevronLeft className="size-4" aria-hidden /> {t("demo.prev")}
                    </Link>
                  </Button>
                ) : (
                  <span />
                )}
                <span className="text-sm text-muted-foreground">
                  {t("demo.page", { page })} / {pages}
                </span>
                {page < pages ? (
                  <Button asChild variant="outline" className="h-11">
                    <Link href={href(page + 1)} rel="next">
                      {t("demo.next")} <ChevronRight className="size-4" aria-hidden />
                    </Link>
                  </Button>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </>
        ) : (
          <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground" data-demo-empty>
            {t("demo.list_empty")}
          </p>
        )}
      </div>
    </>
  );
}
