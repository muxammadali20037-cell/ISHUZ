"use client";

import { Briefcase, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { MyVacancy } from "../types";
import type { WorkerSearchParams } from "../search-params";
import { useWorkersNav } from "./use-workers-nav";

/**
 * "«Kassir» uchun nomzodlar" banneri + vakansiya almashtirish.
 * Vakansiya tanlanmagan bo'lsa ham (faol vakansiyalar bo'lsa) tanlov ko'rsatiladi — moslik foizini yoqish uchun.
 */
export function VacancyBanner({ params, vacancies, vacancy }: { params: WorkerSearchParams; vacancies: MyVacancy[]; vacancy: MyVacancy | null }) {
  const { t, tEnum } = useT();
  const { navigate, pending } = useWorkersNav(params);
  const selectable = vacancies.filter((v) => v.status === "active" || v.id === vacancy?.id);
  if (!selectable.length) return null;

  const options = [{ value: "", label: t("workers.banner.no_vacancy") }, ...selectable.map((v) => ({ value: v.id, label: v.title }))];
  const onChange = (id: string) => {
    const next = id ? (vacancies.find((v) => v.id === id) ?? null) : null;
    const nextHasCoords = next?.lat != null && next.lng != null;
    const keepDistance = params.sort === "distance" && (params.lat !== null || nextHasCoords);
    navigate({ vacancy: id || null, sort: keepDistance ? "distance" : params.sort, max_km: params.lat !== null || nextHasCoords ? params.max_km : null });
  };

  if (!vacancy) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card p-3 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="size-4 text-primary" />
          <span>{t("workers.banner.hint")}</span>
        </div>
        <div className="sm:ml-auto sm:w-72">
          <Select aria-label={t("workers.banner.select_label")} options={options} value="" disabled={pending} onChange={(e) => onChange(e.target.value)} className="h-10 text-sm" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/25 bg-primary-soft/60 p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Briefcase className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold">{t("workers.banner.for_vacancy", { title: vacancy.title })}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("workers.banner.hint")}</p>
          {vacancy.status !== "active" ? (
            <Badge variant="warning" className="mt-2">
              {t("workers.banner.inactive")} · {tEnum("vacancy_status", vacancy.status)}
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="mt-3">
        <Select aria-label={t("workers.banner.select_label")} options={options} value={vacancy.id} disabled={pending} onChange={(e) => onChange(e.target.value)} className="h-10 bg-card text-sm" />
      </div>
    </div>
  );
}
