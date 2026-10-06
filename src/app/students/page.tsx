import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BookOpen, Briefcase, ChevronRight, Clock, GraduationCap, Hammer, Sparkles, type LucideIcon } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { Shell } from "@/components/shared/shell";
import { HomeSection } from "@/features/jobs/components/home/home-section";
import { HomeSectionSkeleton } from "@/features/jobs/components/skeletons";
import { jobsHref } from "@/features/jobs/search-params";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return { title: t("jobs.students.title"), description: t("jobs.students.subtitle"), alternates: localeAlternates("/students", locale) };
}

/**
 * /students — talabalar va tajribasizlar uchun kirish nuqtasi (spec §13). Bular alohida kasb daraxti emas:
 * mavjud kasblar ustidagi imkoniyat turi (stajirovka, amaliyot, shogirdlik) va jadval belgilari.
 */
export default async function StudentsPage() {
  const { t } = await getT();
  const items: { href: string; icon: LucideIcon; title: string; desc: string }[] = [
    { href: jobsHref({ opportunity: ["internship"] }), icon: Briefcase, title: t("enums.opportunity_type.internship"), desc: t("jobs.students.internship_desc") },
    { href: jobsHref({ opportunity: ["practice"] }), icon: BookOpen, title: t("enums.opportunity_type.practice"), desc: t("jobs.students.practice_desc") },
    { href: jobsHref({ opportunity: ["apprenticeship"] }), icon: Hammer, title: t("enums.opportunity_type.apprenticeship"), desc: t("jobs.students.apprenticeship_desc") },
    { href: jobsHref({ noExperience: true }), icon: Sparkles, title: t("jobs.students.no_experience"), desc: t("jobs.students.no_experience_desc") },
    { href: jobsHref({ students: true, employment: ["part_time"] }), icon: Clock, title: t("jobs.students.after_class"), desc: t("jobs.students.after_class_desc") },
  ];
  return (
    <Shell>
      <div className="container-app space-y-7 py-5 sm:py-8">
        <header className="flex items-start gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <GraduationCap className="size-7" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">{t("jobs.students.title")}</h1>
            <p className="mt-1 text-muted-foreground">{t("jobs.students.subtitle")}</p>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <Link key={i.href} href={i.href} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <i.icon className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{i.title}</span>
                <span className="block text-sm text-muted-foreground">{i.desc}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>

        <p className="rounded-2xl bg-secondary/60 p-4 text-sm text-muted-foreground">{t("jobs.students.note")}</p>

        <Suspense fallback={<HomeSectionSkeleton />}>
          <HomeSection title={t("jobs.students.latest")} href={jobsHref({ students: true, sort: "newest" })} args={{ p_student_friendly: true, p_sort: "newest" }} />
        </Suspense>
      </div>
    </Shell>
  );
}
