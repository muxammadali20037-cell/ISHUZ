"use client";

import { Star } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { setVacancyFeatured } from "../actions/vacancies";
import { useAdminAction } from "./use-admin-action";

const DAYS = [7, 14, 30] as const;

/**
 * TOP vakansiya boshqaruvi (admin, vacancies.moderate): hozirgi holat va 7/14/30 kunga TOP qilish yoki olib tashlash.
 * Faqat faol vakansiya uchun ko'rinadi. Qidiruvda TOP birinchi turadi (search_vacancies: featured_now). `active` — serverda
 * hisoblanadi (featuredNow).
 */
export function FeaturedControl({ vacancyId, featuredUntil, active, canModerate }: { vacancyId: string; featuredUntil: string | null; active: boolean; canModerate: boolean }) {
  const { t, locale } = useT();
  const { pending, run } = useAdminAction();
  return (
    <section className="mt-3 rounded-xl border border-border p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Star className="size-4 text-primary" aria-hidden />
        {t("admin.vacancies.featured_title")}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {active
          ? featuredUntil
            ? t("admin.vacancies.featured_until", { date: formatDateTime(featuredUntil, locale) })
            : t("admin.vacancies.featured_on")
          : t("admin.vacancies.featured_off")}
      </p>
      {canModerate ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DAYS.map((d) => (
            <Button
              key={d}
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => setVacancyFeatured({ vacancyId, days: d }), { success: t("admin.vacancies.featured_done") })}
            >
              {t("admin.vacancies.featured_days", { days: d })}
            </Button>
          ))}
          {active ? (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setVacancyFeatured({ vacancyId, days: 0 }), { success: t("admin.vacancies.unfeatured_done") })}>
              {t("admin.vacancies.featured_remove")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
