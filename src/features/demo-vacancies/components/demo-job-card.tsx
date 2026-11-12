"use client";

import Link from "next/link";
import { BriefcaseBusiness, Clock, Eye, FlaskConical, MapPin } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { SalaryText } from "@/components/shared/salary-text";
import { usePlace, useShortPlace } from "@/features/find/components/result-cards";
import { cn } from "@/lib/utils";
import type { DemoVacancy } from "../types";

// haqiqiy vakansiya kartasi bilan bir xil shakl (result-cards.tsx) — lekin kesik chiziqli hoshiya va "Namuna" belgisi bilan
const cardCls = "relative rounded-xl border border-dashed border-border bg-card px-4 py-3 transition-colors hover:border-primary/40 focus-within:border-primary/60";
const stretched = "after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring";
const metaCls = "flex shrink-0 items-center gap-1";
const EXP_STEPS = [60, 36, 24, 12, 6] as const;

/**
 * Namuna (demo) vakansiya kartasi (0077): haqiqiy e'londan aniq ajralib turadi — "Namuna" belgisi, kompaniya nomi yo'q,
 * saqlash va ariza tugmasi yo'q (faqat "Ko'rish"). Bosilganda — /jobs/namuna/<slug> (namuna ekani tushuntirilgan sahifa).
 */
export function DemoJobCard({ job, className }: { job: DemoVacancy; className?: string }) {
  const { t, tEnum, name } = useT();
  const place = usePlace();
  const shortPlace = useShortPlace();
  const title = name({ name_uz: job.title_uz, name_ru: job.title_ru ?? job.title_uz, name_en: job.title_en });
  const step = EXP_STEPS.find((m) => job.experience_min_months >= m);
  const expValue = tEnum("experience_min_months", String(step ?? 6));
  const experience = job.experience_min_months === 0 ? t("easy.card.no_experience") : t("easy.card.experience", { value: expValue });
  const schedule = job.schedule !== "negotiable" ? tEnum("work_schedule", job.schedule) : null;
  const where = place(job, job.is_remote);
  const href = `/jobs/namuna/${job.slug}`;
  return (
    <article className={cn(cardCls, className)} data-demo-card={job.slug}>
      <h3 className="line-clamp-2 break-words text-lg font-bold leading-snug">
        <Link href={href} prefetch={false} className={stretched}>
          {title}
        </Link>
      </h3>
      <SalaryText
        from={job.salary_from}
        to={job.salary_to}
        type={job.salary_type}
        negotiable={job.salary_negotiable}
        className={cn("mt-0.5 block text-base font-bold", job.salary_negotiable || (!job.salary_from && !job.salary_to) ? "text-muted-foreground" : "text-foreground")}
      />
      <ul className="mt-1 flex min-w-0 items-center gap-x-3 text-sm text-muted-foreground">
        <li className="flex min-w-0 items-center gap-1" title={where}>
          <MapPin className="size-4 shrink-0" aria-hidden />
          <span className="truncate" aria-hidden>
            {shortPlace(job, job.is_remote)}
          </span>
          <span className="sr-only">{where}</span>
        </li>
        {schedule ? (
          <li className={metaCls}>
            <Clock className="size-4 shrink-0" aria-hidden />
            <span className="whitespace-nowrap">{schedule}</span>
          </li>
        ) : null}
        <li className={metaCls} title={experience}>
          <BriefcaseBusiness className="size-4 shrink-0" aria-hidden />
          {job.experience_min_months === 0 ? (
            <span className="whitespace-nowrap">{experience}</span>
          ) : (
            <>
              <span className="sr-only">{experience}</span>
              <span className="whitespace-nowrap" aria-hidden>
                {expValue}
              </span>
            </>
          )}
        </li>
      </ul>
      <div className="mt-2 flex items-center gap-2">
        <span className="inline-flex shrink-0 items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-xs font-bold text-foreground/80" data-demo-badge>
          <FlaskConical className="size-3.5" aria-hidden /> {t("demo.badge")}
        </span>
        {/* bezak: butun karta — bitta havola (sarlavha); ariza tugmasi yo'q */}
        <span
          aria-hidden
          className="ml-auto inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-card px-3 text-base font-semibold text-foreground/80"
        >
          <Eye className="size-4" /> {t("demo.view")}
        </span>
      </div>
    </article>
  );
}
