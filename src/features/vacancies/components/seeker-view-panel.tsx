"use client";

import Link from "next/link";
import { CheckCircle2, Clock, Eye, EyeOff } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { JobResultCard } from "@/features/find/components/result-cards";
import type { SeekerViewData } from "../seeker-view";

/**
 * Boshqaruv sahifasida: e'lon ish izlovchilarga ko'rinyaptimi, qidiruvda nechanchi bo'lib chiqadi, ro'yxatdagi kartasi qanday
 * va to'liq sahifani ish izlovchi ko'zi bilan ochish. Karta bosilsa ham — ko'rinish sahifasi (karta ichidagi tugmalar ishlamaydi:
 * ish beruvchi o'z e'loniga ariza yubormasin / o'ziga qo'ng'iroq qilmasin).
 */
export function SeekerViewPanel({ view }: { view: SeekerViewData }) {
  const { t, name } = useT();
  const visible = view.visibility === "visible";
  const StatusIcon = visible ? CheckCircle2 : view.visibility === "pending_review" ? Clock : EyeOff;
  const placeName =
    view.place.kind === "region" ? name(view.place) : view.place.kind === "remote" ? t("vacancies.seeker_view.place_remote") : t("vacancies.seeker_view.place_all");
  const profession = view.profession ? name(view.profession) : null;

  return (
    <section id="korinish" data-seeker-view={view.visibility} aria-labelledby="seeker-view-title" className="mt-6 scroll-mt-20 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
      <h2 id="seeker-view-title" className="flex items-center gap-2 text-lg font-bold">
        <Eye className="size-5 text-primary-ink" aria-hidden />
        {t("vacancies.seeker_view.title")}
      </h2>
      <p
        data-seeker-status
        className={cn(
          "mt-2 flex items-start gap-2 rounded-xl px-3 py-2 text-sm font-medium",
          visible ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
        )}
      >
        <StatusIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{t(`vacancies.seeker_view.status.${view.visibility}`)}</span>
      </p>

      {visible && view.rank && profession ? (
        <p data-seeker-rank className="mt-3 text-sm">
          {view.rank.position
            ? t("vacancies.seeker_view.rank", { profession, place: placeName, position: view.rank.position, total: view.rank.total })
            : t("vacancies.seeker_view.rank_below", { profession, place: placeName, total: view.rank.total, limit: view.rank.limit })}
        </p>
      ) : null}

      <p className="mb-1.5 mt-4 text-xs font-medium text-muted-foreground">{t(visible ? "vacancies.seeker_view.card_label" : "vacancies.seeker_view.card_label_later")}</p>
      <div className="relative max-w-xl" data-seeker-card>
        {/* kartaning o'zi — ish izlovchi ro'yxatda ko'radigan; ichidagi tugmalar o'chirilgan, butun karta ko'rinish sahifasini ochadi */}
        <div inert>
          <JobResultCard job={view.card} />
        </div>
        <Link href={view.previewHref} aria-label={t("vacancies.seeker_view.open_preview")} className="absolute inset-0 rounded-xl ring-primary/40 hover:ring-2" />
      </div>

      <div className="mt-4">
        <Button asChild>
          <Link href={view.previewHref} data-seeker-preview-link>
            <Eye className="size-4" aria-hidden /> {t("vacancies.seeker_view.open_preview")}
          </Link>
        </Button>
      </div>
    </section>
  );
}
