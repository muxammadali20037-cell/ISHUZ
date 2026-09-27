"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Landmark, SlidersHorizontal } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatMoneyShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FilterChip } from "@/components/ui/chip";
import { clearFilters, countActiveFilters, jobsHref, parseJobsSearchParams, type JobsSearchParams } from "../search-params";
import type { JobsFilterRefs } from "../types";
import { FilterSheet, type SheetKind } from "./filter-sheet";

function QuickChip({
  active,
  onClick,
  children,
  icon,
  badge,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  icon?: ReactNode;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors [&_svg]:size-4",
        active ? "border-primary/40 bg-primary-soft text-primary" : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-secondary",
      )}
    >
      {icon}
      <span className="max-w-[11rem] truncate">{children}</span>
      {badge ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">{badge}</span>
      ) : null}
      {!icon ? <ChevronDown className="opacity-60" /> : null}
    </button>
  );
}

/**
 * Tezkor filtr chiplari (Hudud, Maosh, Grafik, Tajriba, Barcha filtrlar) + tanlangan filtrlar (× bilan).
 * Holat URL da: har o'zgarish router.push(/jobs?...) — ulashiladigan havola.
 */
export function FiltersBar({ refs }: { refs: JobsFilterRefs }) {
  const { t, tEnum, name, locale } = useT();
  const router = useRouter();
  const sp = useSearchParams();
  const params = useMemo(() => parseJobsSearchParams(new URLSearchParams(sp.toString())), [sp]);
  const [sheet, setSheet] = useState<SheetKind>("all");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<JobsSearchParams>(params);
  const [pending, startTransition] = useTransition();

  const push = (next: JobsSearchParams) => startTransition(() => router.push(jobsHref(next, { page: 1 })));
  const openSheet = (kind: SheetKind) => {
    setDraft(params);
    setSheet(kind);
    setOpen(true);
  };
  const patch = (p: Partial<JobsSearchParams>) => setDraft((d) => ({ ...d, ...p }));
  const apply = () => {
    setOpen(false);
    push(draft);
  };
  const resetSheet = () => {
    if (sheet === "all") setDraft(clearFilters(draft));
    else if (sheet === "region") patch({ region: null, district: [] });
    else if (sheet === "salary") patch({ salaryMin: null });
    else if (sheet === "schedule") patch({ schedule: [], employment: [] });
    else if (sheet === "experience") patch({ experienceMax: null, noExperience: false });
  };

  const activeCount = countActiveFilters(params);
  const category = params.category ? refs.categories.find((c) => c.slug === params.category) : undefined;
  const subcategory =
    params.subcategory && category ? refs.subcategories.find((s) => s.slug === params.subcategory && s.category_id === category.id) : undefined;
  const region = params.region ? refs.regions.find((r) => r.slug === params.region) : undefined;
  const districts = params.district.flatMap((id) => refs.districts.filter((d) => d.id === id));
  const experienceLabel = params.noExperience
    ? t("jobs.filters.no_experience")
    : params.experienceMax !== null
      ? t(`jobs.filters.experience_options.${params.experienceMax}`)
      : null;

  const regionSummary = region
    ? districts.length
      ? `${name(region)} · ${districts.length}`
      : name(region)
    : districts.length
      ? t("jobs.filters.districts_count", { count: districts.length })
      : null;
  const scheduleLabels = [...params.schedule.map((s) => tEnum("work_schedule", s)), ...params.employment.map((e) => tEnum("employment_type", e))];
  const scheduleSummary = scheduleLabels.length
    ? scheduleLabels.length > 2
      ? `${scheduleLabels.slice(0, 2).join(", ")} +${scheduleLabels.length - 2}`
      : scheduleLabels.join(", ")
    : null;

  const chips: { key: string; label: string; next: JobsSearchParams }[] = [];
  if (category) chips.push({ key: "category", label: name(category), next: { ...params, category: null, subcategory: null } });
  if (subcategory) chips.push({ key: "subcategory", label: name(subcategory), next: { ...params, subcategory: null } });
  if (region) chips.push({ key: "region", label: name(region), next: { ...params, region: null, district: [] } });
  for (const d of districts) chips.push({ key: `district-${d.id}`, label: name(d), next: { ...params, district: params.district.filter((x) => x !== d.id) } });
  if (params.salaryMin)
    chips.push({
      key: "salary",
      label: t("jobs.filters.salary_from", { amount: formatMoneyShort(params.salaryMin, locale) }),
      next: { ...params, salaryMin: null },
    });
  for (const s of params.schedule)
    chips.push({ key: `schedule-${s}`, label: tEnum("work_schedule", s), next: { ...params, schedule: params.schedule.filter((x) => x !== s) } });
  for (const e of params.employment)
    chips.push({ key: `employment-${e}`, label: tEnum("employment_type", e), next: { ...params, employment: params.employment.filter((x) => x !== e) } });
  if (params.format) chips.push({ key: "format", label: tEnum("work_format", params.format), next: { ...params, format: null } });
  if (experienceLabel) chips.push({ key: "experience", label: experienceLabel, next: { ...params, experienceMax: null, noExperience: false } });
  if (params.remote) chips.push({ key: "remote", label: t("jobs.filters.remote"), next: { ...params, remote: false } });
  for (const code of params.benefits) {
    const b = refs.benefits.find((x) => x.code === code);
    chips.push({ key: `benefit-${code}`, label: b ? name(b) : code, next: { ...params, benefits: params.benefits.filter((x) => x !== code) } });
  }
  if (params.verified) chips.push({ key: "verified", label: t("jobs.filters.verified_short"), next: { ...params, verified: false } });
  if (params.government) chips.push({ key: "government", label: t("jobs.filters.government_short"), next: { ...params, government: false } });

  return (
    <div className="space-y-3" aria-busy={pending || undefined}>
      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0"
        role="toolbar"
        aria-label={t("common.actions.filters")}
      >
        <QuickChip onClick={() => openSheet("all")} active={activeCount > 0} icon={<SlidersHorizontal />} badge={activeCount || undefined}>
          {t("jobs.filters.all")}
        </QuickChip>
        <QuickChip onClick={() => openSheet("region")} active={!!regionSummary}>
          {regionSummary ?? t("jobs.filters.region")}
        </QuickChip>
        <QuickChip onClick={() => openSheet("salary")} active={!!params.salaryMin}>
          {params.salaryMin ? `${formatMoneyShort(params.salaryMin, locale)}+` : t("jobs.filters.salary")}
        </QuickChip>
        <QuickChip onClick={() => openSheet("schedule")} active={!!scheduleSummary}>
          {scheduleSummary ?? t("jobs.filters.schedule")}
        </QuickChip>
        <QuickChip onClick={() => openSheet("experience")} active={!!experienceLabel}>
          {experienceLabel ?? t("jobs.filters.experience")}
        </QuickChip>
        <QuickChip onClick={() => push({ ...params, government: !params.government })} active={params.government} icon={<Landmark />}>
          {t("jobs.filters.government_short")}
        </QuickChip>
      </div>

      {chips.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <FilterChip key={c.key} onRemove={() => push(c.next)}>
              {c.label}
            </FilterChip>
          ))}
          <button type="button" onClick={() => push(clearFilters(params))} className="h-8 px-2 text-sm font-medium text-primary hover:underline">
            {t("common.actions.clear_all")}
          </button>
        </div>
      ) : null}

      <FilterSheet
        kind={sheet}
        open={open}
        onOpenChange={setOpen}
        draft={draft}
        patch={patch}
        refs={refs}
        onApply={apply}
        onReset={resetSheet}
        pending={pending}
      />
    </div>
  );
}
