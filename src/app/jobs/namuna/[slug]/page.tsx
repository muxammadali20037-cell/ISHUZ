import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BellRing, BriefcaseBusiness, ChevronLeft, ChevronRight, FileUser, FlaskConical } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";
import { SalaryText } from "@/components/shared/salary-text";
import { getDemoVacancy } from "@/features/demo-vacancies/queries";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [{ t, name }, { slug }] = await Promise.all([getT(), params]);
  const v = await getDemoVacancy(slug);
  // namuna e'lon qidiruv tizimlariga chiqmaydi; JobPosting belgilanishi ham yo'q
  const robots = { index: false, follow: false };
  if (!v) return { title: t("demo.list_title"), robots };
  const title = name({ name_uz: v.title_uz, name_ru: v.title_ru ?? v.title_uz, name_en: v.title_en });
  return { title: t("demo.detail.meta_title", { title }), description: t("demo.detail.banner_desc"), robots };
}

const EXP_STEPS = [60, 36, 24, 12, 6] as const;

/**
 * /jobs/namuna/[slug] — namuna (demo) vakansiya sahifasi (0077): tepada aniq ogohlantirish (haqiqiy ish emas), shartlar
 * (maosh, joy, grafik, bandlik, tajriba, soha) va keyingi qadamlar. Ariza, telefon, kompaniya, saqlash — yo'q.
 */
export default async function DemoVacancyPage({ params }: { params: Params }) {
  const { slug } = await params;
  const v = await getDemoVacancy(slug);
  if (!v) notFound();
  const { t, tEnum, name } = await getT();
  const title = name({ name_uz: v.title_uz, name_ru: v.title_ru ?? v.title_uz, name_en: v.title_en });
  const region = v.region_name_uz ? name({ name_uz: v.region_name_uz, name_ru: v.region_name_ru ?? v.region_name_uz, name_en: v.region_name_en, name_oz: v.region_name_oz }) : null;
  const district = v.district_name_uz
    ? name({ name_uz: v.district_name_uz, name_ru: v.district_name_ru ?? v.district_name_uz, name_en: v.district_name_en, name_oz: v.district_name_oz })
    : null;
  const place = [region, district].filter(Boolean).join(" · ") || (v.is_remote ? t("easy.search.remote") : "—");
  const category = v.category_name_uz ? name({ name_uz: v.category_name_uz, name_ru: v.category_name_ru ?? v.category_name_uz, name_en: v.category_name_en }) : null;
  const step = EXP_STEPS.find((m) => v.experience_min_months >= m);
  const experience = v.experience_min_months === 0 ? t("demo.detail.no_experience") : tEnum("experience_min_months", String(step ?? 6));
  const terms: { label: string; value: string }[] = [
    { label: t("demo.detail.place"), value: v.is_remote && region ? `${place} · ${t("easy.search.remote")}` : place },
    { label: t("demo.detail.schedule"), value: tEnum("work_schedule", v.schedule) },
    { label: t("demo.detail.employment"), value: tEnum("employment_type", v.employment_type) },
    { label: t("demo.detail.experience"), value: experience },
    ...(category ? [{ label: t("demo.detail.category"), value: category }] : []),
  ];
  const steps = [
    { href: "/ai-alerts?role=worker", icon: BellRing, title: t("demo.detail.alert_title"), desc: t("demo.detail.alert_desc") },
    { href: "/post/worker", icon: FileUser, title: t("demo.detail.resume_title"), desc: t("demo.detail.resume_desc") },
    { href: "/post/vacancy", icon: BriefcaseBusiness, title: t("demo.detail.employer_title"), desc: t("demo.detail.employer_desc") },
  ];
  return (
    <>
      <div className="container-narrow space-y-5 py-5 sm:py-8" data-demo-detail={v.slug}>
        <Link href={v.category_slug ? `/jobs/namuna?soha=${v.category_slug}` : "/jobs/namuna"} data-page-back className="inline-flex min-h-11 items-center gap-1 text-base font-semibold text-primary-ink hover:underline">
          <ChevronLeft className="size-4" aria-hidden /> {t("demo.detail.back")}
        </Link>

        <div role="note" className="flex items-start gap-3 rounded-2xl border border-dashed border-border bg-secondary p-4" data-demo-banner>
          <FlaskConical className="mt-0.5 size-6 shrink-0 text-foreground/80" aria-hidden />
          <div className="min-w-0">
            <p className="text-base font-bold">{t("demo.detail.banner_title")}</p>
            <p className="mt-0.5 text-sm text-foreground/80">{t("demo.detail.banner_desc")}</p>
          </div>
        </div>

        <header className="rounded-2xl border border-border bg-card p-5">
          <h1 className="break-words text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">{t("demo.detail.salary")}</p>
          <SalaryText from={v.salary_from} to={v.salary_to} type={v.salary_type} negotiable={v.salary_negotiable} className="block text-xl font-bold" />
        </header>

        <section aria-labelledby="demo-terms" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="demo-terms" className="text-lg font-bold">
            {t("demo.detail.terms_title")}
          </h2>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {terms.map((row) => (
              <div key={row.label} className="min-w-0">
                <dt className="text-sm text-muted-foreground">{row.label}</dt>
                <dd className="break-words text-base font-semibold">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="demo-about" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="demo-about" className="text-lg font-bold">
            {t("demo.detail.about_title")}
          </h2>
          <p className="mt-2 text-base leading-relaxed text-foreground/85">{t("demo.detail.about_text")}</p>
        </section>

        <section aria-labelledby="demo-next" className="space-y-3">
          <h2 id="demo-next" className="text-lg font-bold">
            {t("demo.detail.next_title")}
          </h2>
          <ul className="space-y-2">
            {steps.map(({ href, icon: Icon, title: label, desc }) => (
              <li key={href}>
                <Link href={href} prefetch={false} className="press flex min-h-16 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:border-primary/40">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-ink" aria-hidden>
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{label}</span>
                    <span className="block text-sm leading-snug text-muted-foreground">{desc}</span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <Button asChild variant="outline" className="h-12 w-full text-base font-semibold sm:w-auto">
            <Link href="/jobs">{t("demo.real_jobs")}</Link>
          </Button>
        </section>
      </div>
    </>
  );
}
