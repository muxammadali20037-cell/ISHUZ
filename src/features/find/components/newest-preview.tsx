"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { JobCompactRow, WorkerCompactRow, type JobCardData, type WorkerCardData } from "./result-cards";

export interface SearchPreview {
  mode: "jobs" | "workers";
  /** shu hududdagi barcha faol e'lonlar soni */
  total: number;
  /** "Barcha e'lonlar" — natijalar (barcha kasblar, eslab qolingan hudud yoki butun O'zbekiston) */
  allHref: string;
  placeLabel: string;
  jobs?: JobCardData[];
  workers?: WorkerCardData[];
}

/**
 * Qidiruv boshida (kasb qadami): kasb tanlamasdan ham darhol e'lonlar — "Barcha ish e'lonlari · N ta" (bir bosishda
 * natijalar) va eng yangi bir nechtasi. Kasb tanlash pastda qoladi (aniqroq qidirish uchun).
 */
export function NewestPreview({ preview }: { preview: SearchPreview }) {
  const { t } = useT();
  const jobs = preview.mode === "jobs";
  const items = jobs ? (preview.jobs ?? []) : (preview.workers ?? []);
  if (!preview.total) return null;
  return (
    <section aria-labelledby="newest-title" className="space-y-3">
      <Link
        href={preview.allHref}
        className="press flex min-h-16 items-center gap-3 rounded-2xl bg-primary px-4 py-3 text-primary-foreground shadow-sm hover:bg-primary-hover"
        data-track="search_all"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xl font-extrabold leading-tight">{jobs ? t("easy.search.all_jobs_button") : t("easy.search.all_workers_button")}</span>
          <span className="block text-base opacity-90">
            {t("easy.search.all_count", { count: preview.total })} · {preview.placeLabel}
          </span>
        </span>
        <ArrowRight className="size-6 shrink-0" aria-hidden />
      </Link>
      {items.length ? (
        <>
          <h2 id="newest-title" className="flex items-center gap-2 pt-1 text-xl font-bold">
            <Sparkles className="size-5 text-primary" aria-hidden /> {jobs ? t("easy.search.newest_jobs") : t("easy.search.newest_workers")}
          </h2>
          <ul className="space-y-2">
            {jobs
              ? (preview.jobs ?? []).map((j) => (
                  <li key={j.id}>
                    <JobCompactRow job={j} />
                  </li>
                ))
              : (preview.workers ?? []).map((w) => (
                  <li key={w.id}>
                    <WorkerCompactRow worker={w} />
                  </li>
                ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
